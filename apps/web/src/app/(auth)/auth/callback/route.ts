import { NextResponse } from "next/server";
import { createClient } from "@waytara/supabase/server";

// Supabase's password-recovery email (and any other PKCE-flow email link —
// magic link, invite) redirects here with a `code` query param rather than
// landing directly on the destination page. This exchanges that code for a
// real session (setting cookies via the response), then forwards on to
// wherever the link was actually meant to go — /reset-password for the
// forgot-password flow. Falls back to a login-page error rather than a
// bare 404/500 if the code is missing or already used/expired.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("That link is invalid or has expired.")}`
  );
}
