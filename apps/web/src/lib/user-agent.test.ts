import { describe, expect, it } from "vitest";
import { activeText, describeDevice } from "./user-agent";

const CHROME_WIN = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const EDGE_WIN = `${CHROME_WIN} Edg/120.0.0.0`;
const SAFARI_IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1";
const CHROME_ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
const CHROME_ANDROID_TABLET = "Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const SAFARI_MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15";
const FIREFOX_LINUX = "Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0";

describe("describeDevice", () => {
  it("names the browser and the system, and the kind of device", () => {
    expect(describeDevice(CHROME_WIN)).toMatchObject({ label: "Chrome on Windows", kind: "desktop" });
    expect(describeDevice(SAFARI_IPHONE)).toMatchObject({ label: "Safari on iOS", kind: "phone" });
    expect(describeDevice(CHROME_ANDROID)).toMatchObject({ label: "Chrome on Android", kind: "phone" });
    expect(describeDevice(SAFARI_MAC)).toMatchObject({ label: "Safari on macOS", kind: "desktop" });
    expect(describeDevice(FIREFOX_LINUX)).toMatchObject({ label: "Firefox on Linux", kind: "desktop" });
  });
  it("tells Edge from Chrome and an Android tablet from an Android phone", () => {
    expect(describeDevice(EDGE_WIN).browser).toBe("Edge");
    expect(describeDevice(CHROME_ANDROID_TABLET).kind).toBe("tablet");
  });
  it("copes with nothing or nonsense", () => {
    expect(describeDevice(null)).toEqual({ kind: "unknown", browser: "", os: "", label: "Unknown device" });
    expect(describeDevice("curl/8.0").label).toBe("Browser");
  });
});

describe("activeText", () => {
  const now = Date.parse("2026-10-23T12:00:00Z");
  it("says how long ago, in the unit that fits", () => {
    expect(activeText("2026-10-23T11:59:30Z", now)).toBe("Active now");
    expect(activeText("2026-10-23T11:30:00Z", now)).toBe("Last active 30 min ago");
    expect(activeText("2026-10-23T07:00:00Z", now)).toBe("Last active 5 h ago");
    expect(activeText("2026-10-21T12:00:00Z", now)).toBe("Last active 2 d ago");
    expect(activeText("2026-09-01T12:00:00Z", now)).toMatch(/^Last active 1 Sep/);
  });
});
