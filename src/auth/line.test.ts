import { beforeEach, describe, expect, it, vi } from "vitest";

const liff = vi.hoisted(() => ({
  init: vi.fn(async () => undefined),
  isLoggedIn: vi.fn(() => false),
  getIDToken: vi.fn((): string | null => null),
  login: vi.fn(),
}));
vi.mock("@line/liff", () => ({ default: liff }));

const api = vi.hoisted(() => ({
  login: vi.fn(async () => ({ session_token: "s", user: { display_name: "น้ำ", picture_url: null } })),
  link: vi.fn(async () => ({ display_name: "น้ำ", picture_url: null, identities: { line: true, google: null } })),
}));
vi.mock("../api/client", () => ({ api, API_MODE: "mock" }));

import { loginLine, linkLine, takeLinePending } from "./session";

beforeEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks();
});

describe("LINE login (LIFF)", () => {
  it("sends the browser to LINE and remembers the sign-in until it returns", async () => {
    liff.isLoggedIn.mockReturnValue(false);

    expect(await loginLine()).toBeNull();

    expect(liff.login).toHaveBeenCalledWith({ redirectUri: window.location.href });
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
});
