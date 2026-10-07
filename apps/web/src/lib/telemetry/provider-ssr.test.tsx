import * as React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// The dashboard layout renders the provider on the server, where there is no document, window or navigator. The
// state initializer builds the live manager there too, so it must not touch them.
vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "anon");

describe("TelemetryProvider on the server", () => {
  it("renders without browser globals", async () => {
    expect(typeof document).toBe("undefined");
    const { TelemetryProvider } = await import("./react");
    const html = renderToString(
      <TelemetryProvider userId="u1">
        <p>child</p>
      </TelemetryProvider>
    );
    expect(html).toContain("child");
  });
});
