import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@waytara/supabase/service-role";
import { newAccessToken } from "@waytara/supabase/partner-access";
import { memberKey } from "@waytara/supabase/partner-onboarding";
import { fail, openEditable } from "@/lib/partner-track-api";
import { CREW_INVITE_DAYS, crewLink } from "@/lib/partner-crew-server";
import { loadOnboarding } from "@/lib/partner-onboarding-server";
import { sendMail } from "@/lib/send-mail";
import { buildPartnerCrewInviteMail } from "@/lib/partner-mail";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const schema = z.object({ memberId: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/), via: z.enum(["email", "link"]) });

/** Where each person's link stands: the newest link of each person, and what became of it. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const opened = await openEditable(req.headers, token, "crew", 120);
    if (opened instanceof NextResponse) return opened;
    const { data } = await createServiceRoleClient()
      .from("partner_crew_invites")
      .select("member_id, status, sent_via, expires_at, created_at, opened_at, completed_at")
      .eq("application_id", opened.app.id)
      .neq("status", "revoked")
      .order("created_at", { ascending: false });
    const seen = new Set<string>();
    const invites = (data ?? [])
      .filter((r) => (seen.has(r.member_id) ? false : (seen.add(r.member_id), true)))
      .map((r) => ({ memberId: r.member_id, status: r.status, via: r.sent_via, expired: new Date(r.expires_at).getTime() <= Date.now() && r.status !== "completed", sentAt: r.created_at, openedAt: r.opened_at, completedAt: r.completed_at }));
    return NextResponse.json({ success: true, data: { invites } });
  } catch (error) {
    console.error("API /api/partner/track/crew list error:", error);
    return fail("Something went wrong. Please try again.", 500);
  }
}

/**
 * The partner sends a team member their own link. Every earlier link for that person stops working, even one they finished with, a new one is made (only its hash is kept), and the link is returned
 * so the partner can copy it or share it on WhatsApp; when asked, it is also e-mailed to the person's own address. The partner can only do this for a person they have
 * saved on their own application, and only until they send their onboarding.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const opened = await openEditable(req.headers, token, "crew-send", 40);
    if (opened instanceof NextResponse) return opened;
    const { app } = opened;

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("Please choose the person again.", 400);
    const { memberId, via } = parsed.data;

    const state = await loadOnboarding(app.id);
    const index = state.data.team.members.findIndex((m, i) => memberKey(m, i) === memberId);
    if (index < 0) return fail("Save this person first, then send them the link.", 400);
    const member = state.data.team.members[index];
    if (!member.name) return fail("Type this person's name first.", 400);
    if (via === "email" && !EMAIL.test(member.email)) return fail("Add this person's e-mail address first, or copy the link and send it yourself.", 400);

    const db = createServiceRoleClient();
    await db.from("partner_crew_invites").update({ status: "revoked" }).eq("application_id", app.id).eq("member_id", memberId).in("status", ["sent", "opened", "completed"]);
    const made = newAccessToken();
    const expires = new Date(Date.now() + CREW_INVITE_DAYS * 86_400_000).toISOString();
    const { error } = await db.from("partner_crew_invites").insert({ application_id: app.id, member_id: memberId, token_hash: made.hash, sent_via: via, expires_at: expires });
    if (error) {
      console.error("API /api/partner/track/crew insert error:", error);
      return fail("Couldn't make the link just now. Please try again.", 500);
    }

    const link = crewLink(made.token, new URL(req.url).origin);
    if (via === "email") {
      const business = state.data.business.name || app.companyName;
      after(() => sendMail(member.email, buildPartnerCrewInviteMail({ memberName: member.name, partnerName: app.contactName, business, link, days: CREW_INVITE_DAYS })));
    }
    return NextResponse.json({ success: true, data: { link, via, expiresAt: expires } });
  } catch (error) {
    console.error("API /api/partner/track/crew error:", error);
    return fail("Something went wrong. Please try again.", 500);
  }
}
