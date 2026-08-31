import { Zap } from "lucide-react";
import { Input } from "@waytara/ui/input";
import { Button } from "@waytara/ui/button";
import { createServiceRoleClient } from "@waytara/supabase/service-role";
import { acceptEmployeeInvite } from "./actions";

export default async function EmployeeInvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;

  const service = createServiceRoleClient();
  const { data: invite } = await service
    .from("employee_invites")
    .select("email, role, status, expires_at")
    .eq("token", token)
    .maybeSingle();

  const expired = !!invite && new Date(invite.expires_at).getTime() < Date.now();
  const invalid = !invite || invite.status !== "pending" || expired;

  if (invalid) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 px-4 text-center">
        <h1 className="text-xl font-semibold">This invite link is invalid</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          It may have expired or already been used. Ask whoever invited you
          to send a new one.
        </p>
      </div>
    );
  }

  const action = acceptEmployeeInvite.bind(null, token);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center text-center">
          <Zap className="mb-2 h-6 w-6 text-primary" />
          <h1 className="text-xl font-semibold tracking-tight">
            Join WayTara as {invite.role === "admin" ? "an admin" : "an employee"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{invite.email}</p>
        </div>

        {error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <form action={action} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="full_name" className="text-sm font-medium">
              Full name
            </label>
            <Input id="full_name" name="full_name" required />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="phone" className="text-sm font-medium">
              Phone
            </label>
            <Input id="phone" name="phone" autoComplete="tel" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium">
              Choose a password
            </label>
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
