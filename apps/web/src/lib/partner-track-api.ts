import "server-only";
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@waytara/supabase/service-role";
import { allowRequest, clientIp } from "@/lib/rate-limit";
import { findSessionRecord, type TrackedRecord } from "@/lib/partner-track-server";

/** Where an approved partner signs in: the admin app's sign-in page (partners get their own few pages there). */
export const adminSignInUrl = () => `${(process.env.ADMIN_APP_URL || "https://admin.waytaraenergy.com").replace(/\/+$/, "")}/login`;

export const fail =(error: string, status: number, extra?: Record<string, unknown>) => NextResponse.json({ success: false, error, ...extra }, { status });

/** The signed-in partner's application, after slowing down anyone sending too many requests. The session decides whose it is; nothing in the request can. */
async function openSession(headers: Headers, token: string, bucket: string, limit: number): Promise<TrackedRecord | NextResponse> {
  if (!(await allowRequest(`partner-track:${bucket}`, clientIp(headers), limit, 60 * 60))) return fail("Too many requests. Please try again later.", 429);
  // Only the signed-in partner (the portal, "me"). The e-mailed link never opens the forms: it only leads to the start page, where an e-mail code and a password come first.
  const app = token === "me" ? await findSessionRecord() : null;
  return app ?? fail("Please sign in again.", 401);
}

/**
 * What every onboarding route does first: slow down anyone sending too many requests, open the signed-in partner's application, and make sure it is the stage at
 * which the applicant may still change things. Returns the application, or the response to send back.
 *
 * `limit` is requests per hour per address for this kind of request.
 */
export async function openOnboarding(headers: Headers, token: string, bucket: string, limit: number): Promise<{ app: TrackedRecord; submitted: boolean } | NextResponse> {
  const app = await openSession(headers, token, bucket, limit);
  if (app instanceof NextResponse) return app;
  if (app.status !== "onboarding") return fail("Onboarding is not open for this application.", 409);
  const { data } = await createServiceRoleClient().from("partner_onboarding").select("submitted_at").eq("application_id", app.id).maybeSingle();
  return { app, submitted: Boolean(data?.submitted_at) };
}

/** `openOnboarding`, and in addition refuses once the applicant has sent their onboarding (the page is then read-only). */
export async function openEditable(headers: Headers, token: string, bucket: string, limit: number): Promise<{ app: TrackedRecord } | NextResponse> {
  const opened = await openOnboarding(headers, token, bucket, limit);
  if (opened instanceof NextResponse) return opened;
  if (opened.submitted) return fail("You have already sent this. Contact us if something needs to change.", 409);
  return { app: opened.app };
}

/**
 * For adding or removing a file: while onboarding is open and not yet sent, and for an approved partner (a renewed licence, a new team member's documents). Not while
 * the team is verifying what was sent: what they are checking must not change under them.
 */
export async function openDocuments(headers: Headers, token: string, bucket: string, limit: number): Promise<{ app: TrackedRecord } | NextResponse> {
  const app = await openSession(headers, token, bucket, limit);
  if (app instanceof NextResponse) return app;
  if (app.status === "approved") return { app };
  if (app.status !== "onboarding") return fail("Files cannot be changed while we are checking your details. Contact us if something needs to change.", 409);
  const { data } = await createServiceRoleClient().from("partner_onboarding").select("submitted_at").eq("application_id", app.id).maybeSingle();
  if (data?.submitted_at) return fail("You have already sent this. Contact us if something needs to change.", 409);
  return { app };
}

/** For a partner opening one of their own files again: any stage, as long as they are signed in and the application is theirs. */
export async function openOwn(headers: Headers, token: string, bucket: string, limit: number): Promise<{ app: TrackedRecord } | NextResponse> {
  const app = await openSession(headers, token, bucket, limit);
  return app instanceof NextResponse ? app : { app };
}
