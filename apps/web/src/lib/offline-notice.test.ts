import { describe, expect, it } from "vitest";
import { clearedCookie, dismissalCookie, dismissedAtFromCookies, msUntilReshow, noticeCookieName, OFFLINE_NOTICE_REPEAT_MS } from "./offline-notice";

const H = 60 * 60 * 1000;

describe("msUntilReshow", () => {
  it("shows at once when it was never dismissed", () => {
    expect(msUntilReshow(null, 1000)).toBe(0);
  });
  it("waits out the rest of the 3 hours after a dismissal, then shows", () => {
    expect(msUntilReshow(0 + 1, 1 + 2 * H)).toBe(H);
    expect(msUntilReshow(1000, 1000 + 3 * H)).toBe(0);
    expect(msUntilReshow(1000, 1000 + 5 * H)).toBe(0);
  });
  it("repeats every 3 hours", () => {
    expect(OFFLINE_NOTICE_REPEAT_MS).toBe(3 * H);
  });
});

describe("the cookie", () => {
  it("is read back from the cookie string, per device", () => {
    const name = noticeCookieName("dev-1");
    expect(dismissedAtFromCookies(`a=1; ${name}=1700000000000; b=2`, name)).toBe(1700000000000);
    expect(dismissedAtFromCookies("a=1; b=2", name)).toBeNull();
    expect(dismissedAtFromCookies(`${name}=abc`, name)).toBeNull();
    expect(dismissedAtFromCookies(`${noticeCookieName("dev-2")}=5`, name)).toBeNull();
  });
  it("is written to expire when the notice is due again, and cleared when the device is back", () => {
    expect(dismissalCookie("dev-1", 1234)).toBe(`offline_notice_dev-1=1234; path=/; max-age=${3 * 3600}; samesite=lax`);
    expect(clearedCookie("dev-1")).toContain("max-age=0");
  });
});
