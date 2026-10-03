"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/report-error";

// Renders its own <html>/<body> and gets none of the app's global CSS
// (per the Next docs), so it is deliberately self-contained with inline
// styles — it only shows if the root layout itself throws.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
    reportError(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#0A0F0D", color: "#F4F7F5" }}>
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Something went wrong</h1>
          <p style={{ fontSize: 14, opacity: 0.75, margin: 0, maxWidth: 420 }}>
            An unexpected error occurred. Please try again; if it keeps happening, contact support.
          </p>
          {error.digest && <p style={{ fontFamily: "monospace", fontSize: 12, opacity: 0.6, margin: 0 }}>Reference: {error.digest}</p>}
          <button onClick={() => retry()} style={{ marginTop: 8, padding: "10px 18px", borderRadius: 8, border: "1px solid #3a4a42", background: "#10b981", color: "#04120b", fontWeight: 600, cursor: "pointer" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
