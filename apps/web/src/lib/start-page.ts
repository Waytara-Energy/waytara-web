// Where the dashboard opens after signing in. Kept in profiles.ui_preferences.start_page.

export const START_PAGES = [
  { id: "overview", label: "Overview", hint: "The energy flow and today's numbers", path: "/dashboard" },
  { id: "monitoring", label: "Monitoring", hint: "Live readings of your inverter", path: "/dashboard/monitoring" },
  { id: "performance", label: "Performance", hint: "How your system is doing over time", path: "/dashboard/performance" },
  { id: "reports", label: "Reports", hint: "Statements and downloads", path: "/dashboard/reports" },
  { id: "devices", label: "Devices", hint: "Settings of your devices", path: "/dashboard/devices" },
  { id: "support", label: "Support", hint: "Your tickets and help", path: "/dashboard/support" },
] as const;

export type StartPageId = (typeof START_PAGES)[number]["id"];

export function parseStartPage(raw: unknown): StartPageId {
  const root = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return START_PAGES.find((p) => p.id === root.start_page)?.id ?? "overview";
}

export const startPath = (id: StartPageId): string => START_PAGES.find((p) => p.id === id)?.path ?? "/dashboard";
