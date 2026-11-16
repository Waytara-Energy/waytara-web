import "server-only";
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@waytara/supabase/service-role";
import { allowRequest, clientIp } from "@/lib/rate-limit";
import { findTrackedRecord, type TrackedRecord } from "@/lib/partner-track-server";

export const fail = (error: string, status: number, extra?: Record<string, unknown>) => NextResponse.json({ success: false, error, ...extra }, { status });

/**
 * What every onboarding route does first: slow down anyone sending too many requests, open the application the link belongs to, and make sure it is the stage at
 * which the applicant may still change things. A bad, expired or replaced link gets one answer (404) whatever is wrong with it. Returns the application, or the
 * response to send back.
 *
 * `limit` is requests per hour per address for this kind of request. The applicant's own address, not the link, is what is counted, so a link cannot be used to lock
 * the real owner out.
 */
export async function openOnboarding(headers: Headers, token: string, bucket: string, limit: number): Promise<{ app: TrackedRecord; submitted: boolean } | NextResponse> {
  if (!(await allowRequest(`partner-track:${bucket}`, clientIp(headers), limit, 60 * 60))) return fail("Too many requests. Please try again later.", 429);
  const app = await findTrackedRecord(token);
  if (!app) return fail("This link is not active.", 404);
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
