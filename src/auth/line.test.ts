// LINE sign-in in a browser: the backend's LINE web login (start → LINE → callback → claim).
import { beforeEach, describe, expect, it, vi } from "vitest";

const liff = vi.hoisted(() => ({
  init: vi.fn(async () => undefined),
  isLoggedIn: vi.fn(() => false),
  isInClient: vi.fn(() => false),
  getIDToken: vi.fn((): string | null => null),
  logout: vi.fn(),
}));
vi.mock("@line/liff", () => ({ default: liff }));

const api = vi.hoisted(() => ({
  login: vi.fn(async () => ({ session_token: "s", user: { display_name: "น้ำ", picture_url: null } })),
  link: vi.fn(async () => ({ display_name: "น้ำ", picture_url: null, identities: { line: true, google: null } })),
  lineStart: vi.fn(async () => ({ authorize_url: "https://access.line.me/oauth2/v2.1/authorize?state=x" })),
  lineClaim: vi.fn(async () => ({ session_token: "claimed", user: { display_name: "น้ำ", picture_url: null }, merged_chat: true })),
  logout: vi.fn(async () => undefined),
}));
vi.mock("../api/client", () => ({ api, API_MODE: "http", onInvalidToken: () => {} }));

const assign = vi.fn();

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.resetModules();
  vi.stubEnv("VITE_LIFF_ID", "test-liff"); // read by lib/liff when it loads
  vi.stubGlobal("location", { ...window.location, assign, search: "", hash: "", pathname: "/" });
  window.history.replaceState(null, "", "/");
});

const load = () => import("./session");

describe("LINE sign-in in a browser", () => {
  it("sends the browser to LINE through the backend, with the anonymous chat to fold in", async () => {
    const { loginLine } = await load();

    expect(await loginLine()).toBeNull();

    expect(api.lineStart).toHaveBeenCalledWith("login", expect.any(String));
    expect(assign).toHaveBeenCalledWith("https://access.line.me/oauth2/v2.1/authorize?state=x");
    expect(api.login).not.toHaveBeenCalled();
  });

  it("links through the backend too, without a chat session", async () => {
    const { linkLine } = await load();

    expect(await linkLine()).toBeNull();

    expect(api.lineStart).toHaveBeenCalledWith("link", undefined);
  });

  it("back from LINE: exchanges the claim for a session and cleans the address bar", async () => {
    vi.stubGlobal("location", { ...window.location, assign, search: "?line_claim=abc", hash: "#/account", pathname: "/" });
    const replace = vi.spyOn(window.history, "replaceState");
    const session = await load();

    await session.initSession();

    expect(api.lineClaim).toHaveBeenCalledWith("abc");
    expect(session.getSession()?.token).toBe("claimed");
    expect(replace).toHaveBeenCalledWith(null, "", "/#/account");
    expect(session.takeLineResult()).toEqual({ merged: true });
    expect(session.takeLineResult()).toBeNull();
  });

  it("back from LINE with an error: no session, the error for the account page", async () => {
    vi.stubGlobal("location", { ...window.location, assign, search: "?line_error=browser", hash: "#/account", pathname: "/" });
    const session = await load();

    await session.initSession();

    expect(api.lineClaim).not.toHaveBeenCalled();
    expect(session.getSession()).toBeNull();
    expect(session.takeLineResult()).toEqual({ error: "browser" });
  });
});

describe("LINE sign-in inside the LINE app", () => {
  it("uses LIFF's ID token, no trip to LINE", async () => {
    liff.isInClient.mockReturnValue(true);
    liff.isLoggedIn.mockReturnValue(true);
    liff.getIDToken.mockReturnValue("line-id-token");
    const { loginLine } = await load();

    const res = await loginLine();

    expect(api.login).toHaveBeenCalledWith("line-id-token", expect.any(String), "line");
    expect(res?.session_token).toBe("s");
    expect(api.lineStart).not.toHaveBeenCalled();
  });

  it("fails clearly when LINE gives no ID token (the LIFF app needs the openid scope)", async () => {
    liff.isInClient.mockReturnValue(true);
    liff.isLoggedIn.mockReturnValue(true);
    liff.getIDToken.mockReturnValue(null);
    const { loginLine } = await load();

    await expect(loginLine()).rejects.toThrow("LINE gave no ID token");
  });

  it("signing out forgets LIFF's LINE login too", async () => {
    liff.isLoggedIn.mockReturnValue(true);
    const { logout } = await load();

    await logout();

    expect(liff.logout).toHaveBeenCalled();
  });
});
