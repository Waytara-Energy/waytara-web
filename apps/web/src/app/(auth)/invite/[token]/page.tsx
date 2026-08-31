import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createServiceRoleClient } from "@waytara/supabase/service-role";
import { acceptCustomerInvite } from "./actions";

export default async function CustomerInvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;

  const service = createServiceRoleClient();
  const { data: onboarding } = await service
    .from("customer_onboarding")
    .select("invite_status, leads(full_name, email, phone, address)")
    .eq("invite_token", token)
    .maybeSingle();

  const lead = onboarding?.leads;
  const invalid = !onboarding || onboarding.invite_status !== "pending";

  if (invalid) {
    return (
      <div className="fluid-container flex min-h-screen items-center justify-center py-16">
        <div className="max-w-sm space-y-2 text-center">
          <h1 className="text-xl font-semibold text-theme-primary">
            This invite link is invalid
          </h1>
          <p className="text-sm text-theme-muted">
            It may have already been used, or the link is incorrect. Contact
            your WayTara advisor for a new one.
          </p>
        </div>
      </div>
    );
  }

  const action = acceptCustomerInvite.bind(null, token);
  const leadAddress =
    lead?.address && typeof lead.address === "object" && lead.address !== null
      ? Object.values(lead.address as Record<string, unknown>).filter(Boolean).join(", ")
      : "";

  return (
    <div className="fluid-container flex min-h-screen items-center justify-center py-16">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-theme-primary">
            Set up your WayTara account
          </h1>
          <p className="mt-1 text-sm text-theme-muted">
            Confirm your details and choose a password to finish onboarding.
          </p>
        </div>

        {error ? (
          <div className="rounded-lg border border-theme-border bg-theme-alert-subtle px-4 py-3 text-sm text-theme-alert">
            {error}
          </div>
        ) : null}

        <form action={action} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="full_name">Full name</Label>
            <Input id="full_name" name="full_name" defaultValue={lead?.full_name ?? ""} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={lead?.email ?? ""}
              autoComplete="email"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" name="phone" defaultValue={lead?.phone ?? ""} autoComplete="tel" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="address">Address</Label>
            <Input id="address" name="address" defaultValue={leadAddress} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Choose a password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          <Button type="submit" className="w-full">
            Create account
          </Button>
        </form>
      </div>
    </div>
  );
}
