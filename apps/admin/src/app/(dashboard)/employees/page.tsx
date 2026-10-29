import { MailPlus, ShieldCheck, UserCheck, UsersRound } from "lucide-react";
import { createClient } from "@waytara/supabase/server";
import { getCurrentProfile } from "@waytara/supabase/auth";
import { ActionForm } from "@waytara/ui/action-form";
import { FormSubmit } from "@/components/form-submit";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoadError, PageHeader, StatCard, StatGrid, ToneBadge, type Tone } from "@/components/page-kit";
import { sendEmployeeInvite, revokeInvite } from "./actions";
import { StaffActions } from "./staff-actions";

const ROLE_TONE: Record<string, Tone> = { admin: "violet", employee: "info", site_engineer: "warn" };

function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() < Date.now();
}

// Admin-only route (enforced in proxy.ts): staff account management isn't a day-to-day employee task.
export default async function EmployeesPage() {
  const currentProfile = await getCurrentProfile();
  const supabase = await createClient();

  const [{ data: staff, error }, { data: invites }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, role, created_at, deactivated_at, deleted_at")
      .in("role", ["admin", "employee", "site_engineer"])
      .order("created_at", { ascending: true }),
    supabase.from("employee_invites").select("id, email, role, status, expires_at, created_at").eq("status", "pending").order("created_at", { ascending: false }),
  ]);

  const people = staff ?? [];
  const active = people.filter((p) => !p.deleted_at && !p.deactivated_at);
  const count = (role: string) => active.filter((p) => p.role === role).length;

  return (
    <div className="space-y-6">
      <PageHeader title="Employees" description="Staff accounts, and invites for new admins, employees and site engineers." />

      <StatGrid>
        <StatCard icon={UsersRound} title="Active staff" value={active.length} detail={`${people.length - active.length} revoked or deleted`} />
        <StatCard icon={ShieldCheck} title="Admins" value={count("admin")} detail="Full access" />
        <StatCard icon={UserCheck} title="Employees and engineers" value={count("employee") + count("site_engineer")} detail={`${count("employee")} employees · ${count("site_engineer")} site engineers`} />
        <StatCard icon={MailPlus} title="Pending invites" value={invites?.length ?? 0} detail="Waiting to be accepted" />
      </StatGrid>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invite someone new</CardTitle>
          <CardDescription>They get an e-mail with a link to set up their account.</CardDescription>
        </CardHeader>
        <CardContent>
          <ActionForm action={sendEmployeeInvite} loading="Sending invite…" success="Invite sent." className="flex flex-wrap items-end gap-3">
            <div className="grid gap-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input id="invite-email" type="email" name="email" placeholder="name@waytaraenergy.com" className="w-72" required />
            </div>
            <div className="grid gap-2">
              <Label>Role</Label>
              <Select name="role" defaultValue="employee">
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="site_engineer">Site engineer</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <FormSubmit pendingText="Sending…">Send invite</FormSubmit>
          </ActionForm>
        </CardContent>
      </Card>

      {invites && invites.length > 0 ? (
        <Card className="gap-0 overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pending invite</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="w-28">
                  <span className="sr-only">Revoke</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invites.map((invite) => (
                <TableRow key={invite.id}>
                  <TableCell>{invite.email}</TableCell>
                  <TableCell>
                    <ToneBadge tone={ROLE_TONE[invite.role] ?? "neutral"} className="capitalize">
                      {invite.role.replace("_", " ")}
                    </ToneBadge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{isExpired(invite.expires_at) ? <span className="text-destructive">Expired</span> : new Date(invite.expires_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</TableCell>
                  <TableCell className="text-right">
                    <ActionForm action={revokeInvite.bind(null, invite.id)} loading="Revoking…" success="Invite revoked.">
                      <Button type="submit" variant="outline" size="sm">
                        Revoke
                      </Button>
                    </ActionForm>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : null}

      {error ? (
        <LoadError message={`Couldn't load staff: ${error.message}`} />
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-16 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {people.map((person) => {
                const isSelf = person.id === currentProfile?.id;
                const isGhost = !!person.deleted_at;
                const isRevoked = !!person.deactivated_at && !isGhost;
                const name = person.full_name ?? person.email;
                return (
                  <TableRow key={person.id}>
                    <TableCell>
                      <div className="font-medium">{person.full_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{person.email}</div>
                    </TableCell>
                    <TableCell>
                      <ToneBadge tone={ROLE_TONE[person.role] ?? "neutral"} className="capitalize">
                        {person.role.replace("_", " ")}
                      </ToneBadge>
                    </TableCell>
                    <TableCell>
                      <ToneBadge tone={isGhost ? "bad" : isRevoked ? "neutral" : "good"}>{isGhost ? "Deleted" : isRevoked ? "Revoked" : "Active"}</ToneBadge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{new Date(person.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</TableCell>
                    <TableCell className="text-right">
                      {isSelf ? (
                        <span className="text-xs text-muted-foreground">You</span>
                      ) : isGhost ? (
                        <span className="text-xs text-muted-foreground">Deleted</span>
                      ) : (
                        <StaffActions profileId={person.id} name={name} role={person.role} revoked={isRevoked} />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
