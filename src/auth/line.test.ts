import { beforeEach, describe, expect, it, vi } from "vitest";

const liff = vi.hoisted(() => ({
  init: vi.fn(async () => undefined),
  isLoggedIn: vi.fn(() => false),
  getIDToken: vi.fn((): string | null => null),
  getDecodedIDToken: vi.fn((): { exp: number } | null => ({ exp: Date.now() / 1000 + 3600 })),
  login: vi.fn(),
  logout: vi.fn(),
}));
vi.mock("@line/liff", () => ({ default: liff }));

const api = vi.hoisted(() => ({
  login: vi.fn(async () => ({ session_token: "s", user: { display_name: "น้ำ", picture_url: null } })),
  link: vi.fn(async () => ({ display_name: "น้ำ", picture_url: null, identities: { line: true, google: null } })),
}));
vi.mock("../api/client", async (orig) => ({ ApiError: (await orig<typeof import("../api/client")>()).ApiError, api, API_MODE: "mock" }));

const returned = vi.hoisted(() => ({ value: false }));
vi.mock("../lib/liff", async (orig) => ({ ...(await orig<object>()), returnedFromLine: () => returned.value }));

import { ApiError } from "../api/client";
import { LineReturnError, loginLine, linkLine, logout, takeLinePending } from "./session";

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  returned.value = false;
  liff.getDecodedIDToken.mockReturnValue({ exp: Date.now() / 1000 + 3600 });
});

describe("LINE login (LIFF)", () => {
  it("sends the browser to LINE and remembers the sign-in until it returns", async () => {
    liff.isLoggedIn.mockReturnValue(false);

    expect(await loginLine()).toBeNull();

    // The bare page: LINE adds ?code=… and LIFF reads it from the query, so no #/route in it.
    expect(liff.login).toHaveBeenCalledWith({ redirectUri: window.location.origin + window.location.pathname });
    expect(api.login).not.toHaveBeenCalled();
    expect(takeLinePending()).toBe("login");
    expect(takeLinePending()).toBeNull();
  });

  it("exchanges the LINE ID token with the backend once LINE is signed in", async () => {
    liff.isLoggedIn.mockReturnValue(true);
    liff.getIDToken.mockReturnValue("line-id-token");

    const res = await loginLine();

    expect(api.login).toHaveBeenCalledWith("line-id-token", expect.any(String), "line");
    expect(res?.session_token).toBe("s");
  });

  it("fails clearly when LINE gives no ID token (the LIFF app needs the openid scope)", async () => {
    liff.isLoggedIn.mockReturnValue(true);
    liff.getIDToken.mockReturnValue(null);

    await expect(loginLine()).rejects.toThrow("LINE gave no ID token");
    expect(api.login).not.toHaveBeenCalled();
  });

  it("links LINE to a signed-in account with the same token", async () => {
    liff.isLoggedIn.mockReturnValue(true);
    liff.getIDToken.mockReturnValue("line-id-token");

    await linkLine();

    expect(api.link).toHaveBeenCalledWith("line", "line-id-token");
  });

  it("goes back to LINE for a new token when LIFF's cached one has expired", async () => {
    liff.isLoggedIn.mockReturnValueOnce(true).mockReturnValueOnce(true).mockReturnValue(false);
    liff.getIDToken.mockReturnValue("stale-token");
    liff.getDecodedIDToken.mockReturnValue({ exp: Date.now() / 1000 - 60 });

    expect(await loginLine()).toBeNull();

    expect(liff.logout).toHaveBeenCalled();
    expect(liff.login).toHaveBeenCalled();
    expect(api.login).not.toHaveBeenCalled();
    expect(takeLinePending()).toBe("login");
  });

  it("retries once through LINE when the backend rejects the token, then reports the error", async () => {
    liff.isLoggedIn.mockReturnValue(true);
    liff.getIDToken.mockReturnValue("line-id-token");
    const rejected = new ApiError(401, "invalid_token", "LINE rejected the ID token");
    api.login.mockRejectedValue(rejected);

    expect(await loginLine()).toBeNull();
    expect(liff.logout).toHaveBeenCalledTimes(1);
    expect(liff.login).toHaveBeenCalledTimes(1);

    // Back from LINE: a second rejection is shown, not another round trip.
    expect(takeLinePending()).toBe("login");
    await expect(loginLine()).rejects.toBe(rejected);
    expect(liff.login).toHaveBeenCalledTimes(1);
    api.login.mockReset();
  });

  it("coming back from LINE without signing in (cancelled, back button) stays on the page", async () => {
    liff.isLoggedIn.mockReturnValue(false);

    expect(await loginLine(true)).toBeNull();
    expect(await linkLine(true)).toBeNull();

    expect(liff.login).not.toHaveBeenCalled();
    expect(api.login).not.toHaveBeenCalled();
  });

  it("coming back with an expired cached token stays on the page too", async () => {
    liff.isLoggedIn.mockReturnValueOnce(true).mockReturnValueOnce(true).mockReturnValue(false);
    liff.getIDToken.mockReturnValue("stale-token");
    liff.getDecodedIDToken.mockReturnValue({ exp: Date.now() / 1000 - 60 });

    expect(await loginLine(true)).toBeNull();

    expect(liff.login).not.toHaveBeenCalled();
  });

  it("finishes the sign-in when LINE did sign the person in", async () => {
    liff.isLoggedIn.mockReturnValue(true);
    liff.getIDToken.mockReturnValue("line-id-token");

    expect((await loginLine(true))?.session_token).toBe("s");
  });

  it("says so when LINE sent the browser back but this browser isn't signed in to LINE", async () => {
    liff.isLoggedIn.mockReturnValue(false);
    returned.value = true;

    await expect(loginLine(true)).rejects.toBeInstanceOf(LineReturnError);
    expect(liff.login).not.toHaveBeenCalled();
  });

  it("keeps the pending sign-in in localStorage, so a new tab from the LINE app can finish it", async () => {
    liff.isLoggedIn.mockReturnValue(false);

    await loginLine();
    sessionStorage.clear();

    expect(takeLinePending()).toBe("login");
  });

  it("signing out forgets LIFF's cached LINE login too", async () => {
    liff.isLoggedIn.mockReturnValue(true);

    await logout();

    expect(liff.logout).toHaveBeenCalled();
  });
});
