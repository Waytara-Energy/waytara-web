import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { CadencePanel } from "./cadence-panel";

// The browser-only pieces (the sign-in session and the readings service) are not reached while rendering on the server.
vi.mock("@waytara/supabase/client", () => ({ createClient: () => ({ auth: { getSession: async () => ({ data: { session: null } }) } }) }));

describe("CadencePanel", () => {
  it("renders its first state: the readings picker is loading and the period and download controls are there", () => {
    const html = renderToString(<CadencePanel deviceId="b4c30eb8-fba4-4487-aa7a-3c1b089e36e2" today="2026-10-15" firstDay="2026-08-01" />).replaceAll("<!-- -->", "");
    expect(html).toContain("Readings to include");
    expect(html).toContain("Loading the list");
    expect(html).toContain("Download CSV");
    expect(html).toContain("up to 7 days within the last 4 weeks");
  });

  it("keeps the download off until readings are picked", () => {
    const html = renderToString(<CadencePanel deviceId="b4c30eb8-fba4-4487-aa7a-3c1b089e36e2" today="2026-10-15" firstDay={null} />);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Download CSV"|<button[^>]*aria-label="Download CSV"[^>]*disabled=""/);
  });
});
