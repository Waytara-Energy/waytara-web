import { NextRequest, NextResponse } from "next/server";
import { isIfsc } from "@waytara/supabase/partner-onboarding";
import { allowRequest, clientIp } from "@/lib/rate-limit";

/**
 * The bank and branch an IFSC code belongs to, so the partner need not type them. An IFSC code is public information about a bank branch, not about the person: it
 * is the only thing sent out, to the free public lookup of the banks' own list. The shape is checked first, answers are cached for a day, and a lookup that fails
 * (the service down, a code that does not exist) simply says nothing was found, so the partner can type the bank and branch themselves.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const ifsc = code.toUpperCase();
  if (!isIfsc(ifsc)) return NextResponse.json({ success: false, error: "That does not look like an IFSC code." }, { status: 400 });
  if (!(await allowRequest("partner-ifsc:ip", clientIp(req.headers), 60, 60 * 60))) return NextResponse.json({ success: false, error: "Too many lookups. Please type the bank and branch yourself." }, { status: 429 });
  try {
    const res = await fetch(`https://ifsc.razorpay.com/${ifsc}`, { signal: AbortSignal.timeout(4000), next: { revalidate: 86_400 } });
    if (!res.ok) return NextResponse.json({ success: false, error: "We couldn't find that IFSC code. Please check it, or type the bank and branch yourself." }, { status: 404 });
    const j = (await res.json().catch(() => null)) as { BANK?: unknown; BRANCH?: unknown; CITY?: unknown } | null;
    const bank = typeof j?.BANK === "string" ? j.BANK.slice(0, 120) : "";
    if (!bank) return NextResponse.json({ success: false, error: "We couldn't find that IFSC code. Please check it, or type the bank and branch yourself." }, { status: 404 });
    return NextResponse.json({ success: true, data: { bank, branch: typeof j?.BRANCH === "string" ? j.BRANCH.slice(0, 120) : "", city: typeof j?.CITY === "string" ? j.CITY.slice(0, 80) : "" } });
  } catch {
    return NextResponse.json({ success: false, error: "The lookup is not available just now. Please type the bank and branch yourself." }, { status: 502 });
  }
}
