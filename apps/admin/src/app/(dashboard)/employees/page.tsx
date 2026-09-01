import { createClient } from "@waytara/supabase/server";
import { getCurrentProfile } from "@waytara/supabase/auth";
import { Input } from "@waytara/ui/input";
import { Button } from "@waytara/ui/button";
import { cn } from "@waytara/ui/cn";
import { sendEmployeeInvite, revokeInvite, changeEmployeeRole, revokeEmployeeAccess, restoreEmployeeAccess } from "./actions";
import { DeleteEmployeeButton } from "./delete-employee-button";

const SUCCESS_MESSAGES: Record<string, string> = {
  invited: "Invite sent.",
  revoked: "Invite revoked.",
  "role-updated": "Role updated.",
  "revoked-access": "Access revoked — they can no longer sign in.",
  "restored-access": "Access restored.",
  deleted: "Account permanently deleted.",
};

// Admin-only route (enforced in middleware.ts) — staff account management
// isn't a day-to-day employee task.
export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { error, success } = await searchParams;
  const currentProfile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: staff } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, created_at, deactivated_at, deleted_at")
    .in("role", ["admin", "employee"])
    .order("created_at", { ascending: true });

  const { data: invites } = await supabase
    .from("employee_invites")
    .select("id, email, role, status, expires_at, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  const now = Date.now();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Employees</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage staff accounts and send invites to new admins or employees.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}
      {success && SUCCESS_MESSAGES[success] && (
        <div className="rounded-lg border border-border bg-primary/10 p-4 text-sm text-primary">
          {SUCCESS_MESSAGES[success]}
        </div>
      )}

      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-3 text-sm font-semibold">Invite someone new</h2>
        <form action={sendEmployeeInvite} className="flex flex-wrap items-end gap-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Email</label>
            <Input type="email" name="email" placeholder="name@waytaraenergy.com" className="h-9 w-64" required />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Role</label>
            <select
              name="role"
              className="h-9 rounded-md border border-border bg-background px-2 text-sm"
              defaultValue="employee"
            >
              <option value="employee">Employee</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <Button type="submit" size="sm">
            Send Invite
          </Button>
        </form>
      </div>

      {invites && invites.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-card text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Pending invite</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Expires</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {invites.map((invite) => {
                const expired = new Date(invite.expires_at).getTime() < now;
                return (
                  <tr key={invite.id} className="hover:bg-accent/50">
                    <td className="px-4 py-3">{invite.email}</td>
                    <td className="px-4 py-3 capitalize text-muted-foreground">{invite.role}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {expired ? (
                        <span className="text-destructive">Expired</span>
                      ) : (
                        new Date(invite.expires_at).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                        })
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <form action={revokeInvite.bind(null, invite.id)}>
                        <Button type="submit" variant="outline" size="sm">
                          Revoke
                        </Button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-card text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Joined</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(staff ?? []).map((person) => {
              const isSelf = person.id === currentProfile?.id;
              const isGhost = !!person.deleted_at;
              const isRevoked = !!person.deactivated_at && !isGhost;
              return (
                <tr key={person.id} className="hover:bg-accent/50 align-top">
                  <td className="px-4 py-3 font-medium">{person.full_name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{person.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                        person.role === "admin" ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"
                      )}
                    >
                      {person.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        isGhost
                          ? "bg-destructive/15 text-destructive"
                          : isRevoked
                            ? "bg-accent text-accent-foreground"
                            : "bg-primary/15 text-primary"
                      )}
                    >
                      {isGhost ? "Deleted" : isRevoked ? "Revoked" : "Active"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(person.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3">
                    {isSelf ? (
                      <span className="text-xs text-muted-foreground">You</span>
                    ) : isGhost ? (
                      <span className="text-xs text-muted-foreground">No actions — permanently deleted</span>
                    ) : (
                      <div className="flex min-w-[320px] flex-col items-end gap-2">
                        <div className="flex items-center gap-2">
                          <form action={changeEmployeeRole.bind(null, person.id)} className="flex items-center gap-2">
                            <select
                              name="role"
                              defaultValue={person.role}
                              className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                            >
                              <option value="employee">Employee</option>
                              <option value="admin">Admin</option>
                            </select>
                            <Button type="submit" variant="outline" size="sm">
                              Update role
                            </Button>
                          </form>
                          {isRevoked ? (
                            <form action={restoreEmployeeAccess.bind(null, person.id)}>
                              <Button type="submit" size="sm">
                                Restore access
                              </Button>
                            </form>
                          ) : (
                            <form action={revokeEmployeeAccess.bind(null, person.id)}>
                              <Button type="submit" variant="outline" size="sm">
                                Revoke access
                              </Button>
                            </form>
                          )}
                        </div>
                        <DeleteEmployeeButton profileId={person.id} currentName={person.full_name ?? person.email} />
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
