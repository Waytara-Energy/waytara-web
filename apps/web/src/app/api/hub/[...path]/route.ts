import { NextRequest } from "next/server";

// A same-origin door to the readings service (the hub) for the Cadence files, used when the page runs on this computer (localhost).
// The hub only lets the live websites call it from a browser (CORS, https only), so a page on localhost cannot reach it directly; this
// route asks on the page's behalf, from the server, and hands the answer back. The person's own sign-in token travels with the request
// and the hub checks it, exactly as when the browser asks directly; nothing here has a secret of its own.
//
//   GET /api/hub/v1/reports/cadence/keys?equipment=...
//   GET /api/hub/v1/reports/cadence?equipment=...&from=...&to=...&keys=...&format=json|csv
//
// Only the cadence report paths are passed through.
const GATEWAY_URL = process.env.GATEWAY_URL ?? process.env.NEXT_PUBLIC_GATEWAY_URL ?? "https://hub.waytaraenergy.com";
const ALLOWED = new Set(["v1/reports/cadence", "v1/reports/cadence/keys"]);

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const target = path.join("/");
  if (!ALLOWED.has(target)) return Response.json({ error: { message: "Not found" } }, { status: 404 });
  const token = req.headers.get("authorization");
  if (!token) return Response.json({ error: { message: "Please sign in again." } }, { status: 401 });

  let upstream: Response;
  try {
    upstream = await fetch(`${GATEWAY_URL.replace(/\/+$/, "")}/${target}${req.nextUrl.search}`, { headers: { Authorization: token }, cache: "no-store" });
  } catch {
    return Response.json({ error: { message: "The readings service could not be reached." } }, { status: 502 });
  }
  const headers = new Headers();
  for (const name of ["content-type", "content-disposition", "retry-after"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("Cache-Control", "no-store");
  return new Response(upstream.body, { status: upstream.status, headers });
}
