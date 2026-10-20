// Inside the LINE app (LIFF browser): signing in to NamMa without a button, and staying signed out after signing out.
import { beforeEach, describe, expect, it, vi } from "vitest";

const liff = vi.hoisted(() => ({
  init: vi.fn(async () => undefined),
  isLoggedIn: vi.fn(() => true),
  isInClient: vi.fn(() => true),
  getIDToken: vi.fn((): string | null => "line-id-token"),
  getDecodedIDToken: vi.fn(() => ({ exp: Date.now() / 1000 + 3600 })),
  login: vi.fn(),
  logout: vi.fn(),
}));
vi.mock("@line/liff", () => ({ default: liff }));

const api = vi.hoisted(() => ({
  login: vi.fn(async () => ({ session_token: "s", user: { display_name: "น้ำ", picture_url: null } })),
  logout: vi.fn(async () => undefined),
}));
vi.mock("../api/client", async (orig) => ({
  ApiError: (await orig<typeof import("../api/client")>()).ApiError,
  api,
  API_MODE: "http",
}));
const device = vi.hoisted(() => ({ phone: true }));
vi.mock("../lib/liff", async (orig) => ({
  ...(await orig<object>()),
  LIFF_ID: "test-liff",
  LIFF_APP_URL: "https://liff.line.me/test-liff",
  onPhone: () => device.phone,
}));

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  liff.isInClient.mockReturnValue(true);
  vi.resetModules();
  device.phone = true;
  vi.stubEnv("VITE_LIFF_ID", "test-liff"); // read by lib/liff when it loads
});

async function load() {
  return import("./session");
}

describe("LINE sign-in inside the LINE app", () => {
  it("signs in to NamMa with the LINE login LIFF already has", async () => {
    const session = await load();

    expect(await session.autoLineSignIn()).toBe(true);

    expect(api.login).toHaveBeenCalledWith("line-id-token", expect.any(String), "line");
    expect(session.getSession()?.token).toBe("s");
  });

  it("does nothing outside the LINE app", async () => {
    liff.isInClient.mockReturnValueOnce(false);
    const session = await load();

    expect(await session.autoLineSignIn()).toBe(false);
    expect(api.login).not.toHaveBeenCalled();
  });

  it("stays signed out after signing out, until the person signs in again", async () => {
    const session = await load();
    await session.autoLineSignIn();
    await session.logout();
    api.login.mockClear();

    expect(await session.autoLineSignIn()).toBe(false);
    expect(api.login).not.toHaveBeenCalled();
  });

});

describe("LINE sign-in from a phone browser", () => {
  it("goes through the LINE app on a phone, LINE's web login elsewhere", async () => {
    liff.isInClient.mockReturnValue(false);
    const session = await load();
    expect(session.lineViaApp()).toBe(true);

    device.phone = false;
    expect(session.lineViaApp()).toBe(false);
  });

  it("notices when liff.line.me sent the browser straight back instead of opening the LINE app", async () => {
    liff.isInClient.mockReturnValue(false);
    const session = await load();

    session.markLineAppTrip();
    expect(session.takeLineAppBounce()).toBe(true);
  });

  it("no bounce without a trip to the LINE app", async () => {
    liff.isInClient.mockReturnValue(false);
    const session = await load();

    expect(session.takeLineAppBounce()).toBe(false);
  });
});
