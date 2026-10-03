import { ImageResponse } from "next/og";
import { SITE } from "@/lib/site";

export const alt = `${SITE.name} — ${SITE.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Generated at build time, so link previews (WhatsApp, LinkedIn, X, Slack) and
// AI answer engines get a branded card without a hand-maintained image file.
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(135deg, #0A0F0D 0%, #0f2a20 60%, #10b981 160%)",
          color: "#F4F7F5",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 40, fontWeight: 700, color: "#34d399" }}>
          <div style={{ width: 20, height: 20, borderRadius: 999, background: "#34d399" }} />
          WayTara
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.05, maxWidth: 980 }}>
            Your property&apos;s energy, designed as one intelligent system.
          </div>
          <div style={{ fontSize: 32, color: "#a7c4b8", maxWidth: 900 }}>
            Solar · Battery storage · EV charging · Monitoring — under one accountable warranty.
          </div>
        </div>
        <div style={{ fontSize: 28, color: "#6ee7b7" }}>waytaraenergy.com</div>
      </div>
    ),
    size
  );
}
