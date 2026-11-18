"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Eye, MailPlus, MoreHorizontal, Pencil, Send, ShieldCheck, Trash2, UserPlus, Users } from "lucide-react";
import { notify } from "@waytara/ui/notify";
import { ROLE_PRESETS, TEAM_PAGES, accessSummary, type DeviceLevel, type TeamPage, type TeamRole } from "@waytara/supabase/team";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ButtonSpinner } from "@/components/ui/spinner";
import { inviteTeamMember, removeTeamMember, resendTeamInvite, setTeamMemberStatus, updateTeamMember, type TeamResult } from "@/app/dashboard/settings/team-actions";
import type { TeamMemberView } from "@/lib/team-server";
import { whenText } from "@/lib/account-events";
import { cn } from "@/lib/utils";
import { FieldRow, Pill, SettingsCard } from "./settings-card";

export interface TeamDevice {
  id: string;
  name: string;
  kind: string;
}
export interface TeamSite {
  id: string;
  name: string;
  devices: TeamDevice[];
}
export interface TeamProps {
  /** The person looking is a super user, not the owner: they can manage the team, but only the owner can change or remove a super user. */
  viewerIsSuper?: boolean;
  members: TeamMemberView[];
  /** only the owner's own sites: the devices that can be shared */
  sites: TeamSite[];
  now: number;
}

/** What the invite / edit dialog holds while it is open. */
interface Draft {
  email: string;
  fullName: string;
  role: TeamRole;
  pages: TeamPage[];
  canSchedule: boolean;
  /** device id -> level; a device that is not here is not shared */
  devices: Record<string, DeviceLevel>;
}

const PRESET_KEYS = Object.keys(ROLE_PRESETS) as Exclude<TeamRole, "custom">[];

function draftFromPreset(role: Exclude<TeamRole, "custom">, sites: TeamSite[], keep?: Draft): Draft {
  const p = ROLE_PRESETS[role];
  const devices: Record<string, DeviceLevel> = {};
  // a role sets the level of every device that is already ticked (a new invitation starts with every device ticked)
  const ids = keep ? Object.keys(keep.devices) : sites.flatMap((s) => s.devices.map((d) => d.id));
  for (const id of ids) devices[id] = p.level;
  return { email: keep?.email ?? "", fullName: keep?.fullName ?? "", role, pages: [...p.pages], canSchedule: p.canSchedule, devices };
}

const STATUS: Record<TeamMemberView["status"], { label: string; tone: "emerald" | "amber" | "slate" }> = {
  active: { label: "Active", tone: "emerald" },
  invited: { label: "Invited", tone: "amber" },
  suspended: { label: "Suspended", tone: "slate" },
};

/** Settings > Team: the people the owner has invited to see their system, what each may see (pages), and for each device whether they may only look or also operate it. */
export function TeamSection({ members, sites, now, viewerIsSuper = false }: TeamProps) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<{ member: TeamMemberView | null } | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = React.useState<TeamMemberView | null>(null);
  const hasDevices = sites.some((s) => s.devices.length > 0);

  async function run(id: string, action: () => Promise<TeamResult>) {
    setBusyId(id);
    try {
      const r = await action();
      if (r.ok) {
        notify.success(r.message);
        router.refresh();
      } else notify.error(r.error);
    } catch {
      notify.error("Something went wrong. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <SettingsCard
        title="Your team"
        description="Invite people by e-mail to see your energy system. You choose the pages they see and, device by device, whether they can only look or also operate it. Billing, Support and these settings always stay with you."
        icon={Users}
        tone="teal"
        badge={<Pill tone="teal">{members.length} {members.length === 1 ? "person" : "people"}</Pill>}
        footer={
          <Button type="button" size="sm" disabled={!hasDevices} onClick={() => setEditing({ member: null })}>
            <UserPlus className="size-3.5" />
            Invite someone
          </Button>
        }
      >
        {!hasDevices && <p className="rounded-lg border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">You have no devices on your own sites yet, so there is nothing to share. Once your system is installed you can invite people here.</p>}
        {hasDevices && members.length === 0 && (
          <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
            <MailPlus className="mx-auto size-6 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium text-foreground">No one has been invited yet</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Family, a facility manager or an installer can each get their own sign-in with only the access you choose.</p>
          </div>
        )}
        {members.length > 0 && (
          <ul className="-my-2 divide-y divide-border">
            {members.map((m) => {
              const st = STATUS[m.status];
              const operate = m.devices.filter((d) => d.level === "operate").length;
              return (
                <li key={m.id} className="flex flex-wrap items-center gap-3 py-3.5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-teal-500/15 text-sm font-semibold uppercase text-teal-600 dark:text-teal-400">{(m.fullName || m.email).slice(0, 1)}</span>
                  <div className="min-w-0 flex-1 basis-56">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                      <span className="truncate">{m.fullName || m.email}</span>
                      <Pill tone={st.tone}>{m.status === "invited" && m.expired ? "Link expired" : st.label}</Pill>
                    </p>
                    {m.fullName && <p className="truncate text-xs text-muted-foreground">{m.email}</p>}
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {accessSummary(m)}
                      {m.status === "invited" ? ` · sent ${whenText(m.lastSentAt ?? m.invitedAt, now)}` : m.acceptedAt ? ` · joined ${whenText(m.acceptedAt, now)}` : ""}
                    </p>
                    {operate === 0 && m.devices.length > 0 && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <Eye className="size-3" /> View only
                      </p>
                    )}
                  </div>
                  {viewerIsSuper && m.role === "super" ? (
                    <span className="text-xs text-muted-foreground">Owner only</span>
                  ) : (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="ghost" size="icon" aria-label={`Actions for ${m.fullName || m.email}`} disabled={busyId === m.id}>
                        {busyId === m.id ? <ButtonSpinner show /> : <MoreHorizontal className="size-4" />}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setEditing({ member: m })}>
                        <Pencil className="size-4" /> Change access
                      </DropdownMenuItem>
                      {m.status === "invited" && (
                        <DropdownMenuItem onSelect={() => void run(m.id, () => resendTeamInvite(m.id))}>
                          <Send className="size-4" /> Send the invitation again
                        </DropdownMenuItem>
                      )}
                      {m.status === "active" && (
                        <DropdownMenuItem onSelect={() => void run(m.id, () => setTeamMemberStatus(m.id, "suspended"))}>
                          <ShieldCheck className="size-4" /> Suspend
                        </DropdownMenuItem>
                      )}
                      {m.status === "suspended" && (
                        <DropdownMenuItem onSelect={() => void run(m.id, () => setTeamMemberStatus(m.id, "active"))}>
                          <ShieldCheck className="size-4" /> Let back in
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onSelect={() => setConfirmRemove(m)}>
                        <Trash2 className="size-4" /> {m.status === "invited" ? "Cancel invitation" : "Remove"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </SettingsCard>

      <div className="grid gap-4 sm:grid-cols-3">
        {PRESET_KEYS.map((k) => (
          <div key={k} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <p className="text-sm font-semibold text-foreground">{ROLE_PRESETS[k].label}</p>
            <p className="mt-1 text-xs text-muted-foreground">{ROLE_PRESETS[k].description}</p>
          </div>
        ))}
      </div>

      {editing && <MemberDialog member={editing.member} sites={sites} viewerIsSuper={viewerIsSuper} onClose={() => setEditing(null)} onDone={() => { setEditing(null); router.refresh(); }} />}

      <Dialog open={!!confirmRemove} onOpenChange={(o) => !o && setConfirmRemove(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{confirmRemove?.status === "invited" ? "Cancel this invitation?" : "Remove this person?"}</DialogTitle>
            <DialogDescription>
              {confirmRemove?.status === "invited"
                ? `The link sent to ${confirmRemove?.email} will stop working.`
                : `${confirmRemove?.fullName || confirmRemove?.email} will no longer see your system. Their own WayTara sign-in is not deleted.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmRemove(null)}>
              Keep
            </Button>
            <Button
              type="button"
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => {
                const m = confirmRemove;
                setConfirmRemove(null);
                if (m) void run(m.id, () => removeTeamMember(m.id));
              }}
            >
              {confirmRemove?.status === "invited" ? "Cancel invitation" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Invite (member === null) or change the access of one person: e-mail and name, a ready-made role that fills in the rest, then pages, schedules and each device's level. */
function MemberDialog({ member, sites, viewerIsSuper, onClose, onDone }: { member: TeamMemberView | null; sites: TeamSite[]; viewerIsSuper: boolean; onClose: () => void; onDone: () => void }) {
  const isNew = member === null;
  const [draft, setDraft] = React.useState<Draft>(() =>
    member
      ? {
          email: member.email,
          fullName: member.fullName ?? "",
          role: member.role as TeamRole,
          pages: [...member.pages],
          canSchedule: member.canSchedule,
          devices: Object.fromEntries(member.devices.map((d) => [d.equipmentId, d.level])),
        }
      : draftFromPreset("viewer", sites),
  );
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  // any hand edit after choosing a role makes the role "Custom" (the ready-made ones are only a starting point)
  const edit = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch, role: "custom" }));
  const pickRole = (r: Exclude<TeamRole, "custom">) => setDraft((d) => ({ ...draftFromPreset(r, sites, d) }));
  const togglePage = (p: TeamPage, on: boolean) => {
    const pages = on ? [...draft.pages, p] : draft.pages.filter((x) => x !== p);
    // schedules live on the Reports page, so taking Reports away also takes the schedule switch away
    edit({ pages, canSchedule: p === "reports" && !on ? false : draft.canSchedule });
  };
  const setDevice = (id: string, level: DeviceLevel | null) => {
    const devices = { ...draft.devices };
    if (level === null) delete devices[id];
    else devices[id] = level;
    edit({ devices });
  };
  const count = Object.keys(draft.devices).length;

  async function save() {
    setBusy(true);
    setError("");
    const input = { email: draft.email, fullName: draft.fullName, role: draft.role, pages: draft.pages, canSchedule: draft.canSchedule, devices: Object.entries(draft.devices).map(([equipmentId, level]) => ({ equipmentId, level })) };
    try {
      const r = isNew ? await inviteTeamMember(input) : await updateTeamMember(member.id, input);
      if (!r.ok) return setError(r.error);
      notify.success(r.message);
      onDone();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isNew ? "Invite someone" : "Change access"}</DialogTitle>
          <DialogDescription>{isNew ? "They get an e-mail with a link, confirm their address with a code, and choose a password." : `${member.fullName || member.email}: changes apply the next time they open a page.`}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {isNew && (
            <div className="grid gap-3 sm:grid-cols-2">
              <FieldRow label="E-mail address" htmlFor="team-email">
                <Input id="team-email" type="email" value={draft.email} onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))} autoComplete="off" maxLength={254} placeholder="name@example.com" />
              </FieldRow>
              <FieldRow label="Name (optional)" htmlFor="team-name">
                <Input id="team-name" value={draft.fullName} onChange={(e) => setDraft((d) => ({ ...d, fullName: e.target.value }))} maxLength={120} autoComplete="off" />
              </FieldRow>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Role</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {PRESET_KEYS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => pickRole(k)}
                  aria-pressed={draft.role === k}
                  className={cn("rounded-xl border p-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring", draft.role === k ? "border-primary bg-primary/5" : "border-border hover:border-primary/50")}
                >
                  <span className="block text-sm font-semibold text-foreground">{ROLE_PRESETS[k].label}</span>
                </button>
              ))}
              <div className={cn("rounded-xl border p-3", draft.role === "custom" ? "border-primary bg-primary/5" : "border-dashed border-border")}>
                <span className="block text-sm font-semibold text-foreground">Custom</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{draft.role === "custom" ? "You changed the access by hand." : ROLE_PRESETS[draft.role as Exclude<TeamRole, "custom">]?.description}</p>
          </div>

          {draft.role === "super" ? (
            <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-3 text-sm text-foreground">
              A super user has everything, like you: every page, every device (new ones too) to operate, scheduled reports, and managing the team. {viewerIsSuper ? "Only the owner can change or remove a super user." : "Only you can change or remove a super user."} Billing, support tickets and alert rules stay with the account owner.
            </p>
          ) : (
            <>
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Devices ({count} chosen)</p>
            <div className="space-y-3">
              {sites.map((s) => (
                <div key={s.id} className="rounded-xl border border-border">
                  <p className="border-b border-border bg-muted/30 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{s.name}</p>
                  <ul className="divide-y divide-border">
                    {s.devices.map((d) => {
                      const level = draft.devices[d.id] ?? null;
                      return (
                        <li key={d.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                          <Checkbox id={`dev-${d.id}`} checked={level !== null} onCheckedChange={(c) => setDevice(d.id, c === true ? "read" : null)} aria-label={`Share ${d.name}`} />
                          <label htmlFor={`dev-${d.id}`} className="min-w-0 flex-1 basis-40 text-sm">
                            <span className="block truncate font-medium text-foreground">{d.name}</span>
                            <span className="block text-xs text-muted-foreground">{d.kind}</span>
                          </label>
                          {level !== null && (
                            <div role="group" aria-label={`Access to ${d.name}`} className="inline-flex rounded-lg border border-border p-0.5 text-xs">
                              {(["read", "operate"] as const).map((l) => (
                                <button
                                  key={l}
                                  type="button"
                                  aria-pressed={level === l}
                                  onClick={() => setDevice(d.id, l)}
                                  className={cn("rounded-md px-2.5 py-1 font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring", level === l ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                                >
                                  {l === "read" ? "Read only" : "Read and operate"}
                                </button>
                              ))}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Read only: sees readings, history and alerts. Read and operate: also changes the device&apos;s settings and starts or stops charging.</p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Pages they can see</p>
            <ul className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
              {TEAM_PAGES.map((p) => (
                <li key={p.key} className="flex items-start gap-2.5">
                  <Checkbox id={`page-${p.key}`} className="mt-0.5" checked={draft.pages.includes(p.key)} onCheckedChange={(c) => togglePage(p.key, c === true)} />
                  <label htmlFor={`page-${p.key}`} className="text-sm">
                    <span className="block font-medium text-foreground">{p.label}</span>
                    <span className="block text-xs text-muted-foreground">{p.hint}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl border border-border px-3 py-3">
            <div className="flex min-w-0 items-start gap-2.5">
              <CalendarClock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">Manage scheduled reports</p>
                <p className="text-xs text-muted-foreground">Create, pause and delete the reports e-mailed on a schedule. Needs the Reports page.</p>
              </div>
            </div>
            <Switch checked={draft.canSchedule} disabled={!draft.pages.includes("reports")} onCheckedChange={(v) => edit({ canSchedule: v })} aria-label="Manage scheduled reports" />
          </div>

            </>
          )}

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void save()} disabled={busy || (isNew && draft.email.trim() === "")}>
            <ButtonSpinner show={busy} />
            {isNew ? "Send invitation" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
