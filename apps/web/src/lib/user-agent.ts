// What a browser says about itself, in words a person recognises ("Chrome on Windows", a phone, a laptop), for the list of signed-in devices.
// A best guess from the User-Agent string: good enough to tell your phone from your laptop, not a precise inventory.

export type DeviceKind = "phone" | "tablet" | "desktop" | "unknown";

export interface DeviceInfo {
  kind: DeviceKind;
  browser: string;
  os: string;
  /** "Chrome on Windows", or "Unknown device" when the browser told us nothing */
  label: string;
}

function browserOf(ua: string): string {
  if (/Edg(e|A|iOS)?\//.test(ua)) return "Edge";
  if (/OPR\/|Opera/.test(ua)) return "Opera";
  if (/SamsungBrowser\//.test(ua)) return "Samsung Internet";
  if (/Firefox\/|FxiOS\//.test(ua)) return "Firefox";
  if (/CriOS\/|Chrome\//.test(ua)) return "Chrome";
  if (/Safari\//.test(ua) && /Version\//.test(ua)) return "Safari";
  if (/Safari\//.test(ua)) return "Safari";
  return "Browser";
}

function osOf(ua: string): string {
  if (/iPhone/.test(ua)) return "iOS";
  if (/iPad/.test(ua)) return "iPadOS";
  if (/Android/.test(ua)) return "Android";
  if (/Windows/.test(ua)) return "Windows";
  if (/CrOS/.test(ua)) return "ChromeOS";
  if (/Mac OS X|Macintosh/.test(ua)) return "macOS";
  if (/Linux|X11/.test(ua)) return "Linux";
  return "";
}

function kindOf(ua: string, os: string): DeviceKind {
  if (/iPhone/.test(ua) || (/Android/.test(ua) && /Mobile/.test(ua))) return "phone";
  if (/iPad|Tablet/.test(ua) || os === "Android") return "tablet";
  if (os === "Windows" || os === "macOS" || os === "Linux" || os === "ChromeOS") return "desktop";
  return "unknown";
}

export function describeDevice(userAgent: string | null | undefined): DeviceInfo {
  const ua = (userAgent ?? "").trim();
  if (!ua) return { kind: "unknown", browser: "", os: "", label: "Unknown device" };
  const browser = browserOf(ua);
  const os = osOf(ua);
  return { kind: kindOf(ua, os), browser, os, label: os ? `${browser} on ${os}` : browser };
}

/** "Active now", "Last active 5 min ago", "Last active 3 h ago", "Last active 12 Oct". `now` is passed in so a render never reads the clock. */
export function activeText(lastActive: string, now: number): string {
  const s = Math.max(0, Math.round((now - Date.parse(lastActive)) / 1000));
  if (s < 120) return "Active now";
  if (s < 3600) return `Last active ${Math.floor(s / 60)} min ago`;
  if (s < 86_400) return `Last active ${Math.floor(s / 3600)} h ago`;
  if (s < 7 * 86_400) return `Last active ${Math.floor(s / 86_400)} d ago`;
  return `Last active ${new Date(lastActive).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`;
}
