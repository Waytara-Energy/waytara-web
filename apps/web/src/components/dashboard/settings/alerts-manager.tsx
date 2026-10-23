"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BellRing, Mail, Pencil, Plus, Smartphone } from "lucide-react";
import { withPromiseToast } from "@waytara/ui/notify";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ButtonSpinner } from "@/components/ui/spinner";
import { COOLDOWN_CHOICES, METRICS, METRIC_GROUPS, formatLimit, metricOf, presetOf, type EffectiveRule, type MetricGroup, type Op } from "@/lib/alert-rules";
import { deleteAlertRule, saveAlertRule, type AlertInput } from "@/app/dashboard/settings/actions";
import { cn } from "@/lib/utils";
import { FieldRow } from "./settings-card";

export interface AlertSite {
  id: string;
  name: string;
}

const SEVERITY_DOT: Record<EffectiveRule["severity"], string> = { info: "bg-sky-500", warning: "bg-amber-500", critical: "bg-rose-500" };

const toInput = (r: EffectiveRule, over: Partial<AlertInput> = {}): AlertInput => ({
  id: r.presetId ? null : r.ruleId,
  presetId: r.presetId,
  name: r.presetId ? "" : r.title,
  metric: r.metric,
  op: r.op,
  threshold: r.threshold,
  siteId: r.siteId,
  email: r.email,
  app: r.app,
  cooldownMinutes: r.cooldownMinutes,
  enabled: r.enabled,
  ...over,
});

/** The "My alerts" part of Settings > Notifications: WayTara's ready-made alerts for the battery, solar, grid, consumption and cost (some on from
 *  the start, each can be switched off or given another limit), and the customer's own ("tell me when the battery is below 25%"). */
export function AlertsManager({ rules, sites }: { rules: EffectiveRule[]; sites: AlertSite[] }) {
  const router = useRouter();
  const [local, setLocal] = React.useState(rules);
  const [seen, setSeen] = React.useState(() => JSON.stringify(rules));
  const incoming = JSON.stringify(rules);
  if (incoming !== seen) {
    setSeen(incoming);
    setLocal(rules);
  }
  const [editing, setEditing] = React.useState<{ rule: EffectiveRule | null } | null>(null);

  const presets = local.filter((r) => r.presetId);
  const mine = local.filter((r) => !r.presetId);
  const groups = METRIC_GROUPS.map((g) => ({ group: g, items: presets.filter((r) => metricOf(r.metric)?.group === g) })).filter((g) => g.items.length > 0);

  async function toggle(rule: EffectiveRule, enabled: boolean) {
    setLocal((cur) => cur.map((r) => (r.key === rule.key ? { ...r, enabled } : r)));
    const ok = await withPromiseToast(saveAlertRule, { loading: "Saving…", success: enabled ? "Alert on." : "Alert off." })(toInput(rule, { enabled }));
    if (ok) router.refresh();
    else setLocal((cur) => cur.map((r) => (r.key === rule.key ? { ...r, enabled: !enabled } : r)));
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-start justify-between gap-4 p-5 pb-3 sm:p-6 sm:pb-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">My own alerts</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Tell me when something reaches a limit you choose, for example when the battery level is below 25%.</p>
          </div>
          <Button type="button" size="sm" className="shrink-0" onClick={() => setEditing({ rule: null })}>
            <Plus className="size-3.5" />
            Add an alert
          </Button>
        </div>
        <div className="px-5 pb-4 sm:px-6">
          {mine.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">You have not made an alert of your own yet.</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {mine.map((r) => (
                <AlertRow key={r.key} rule={r} sites={sites} onToggle={(v) => void toggle(r, v)} onEdit={() => setEditing({ rule: r })} />
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card">
        <div className="p-5 pb-3 sm:p-6 sm:pb-3">
          <h2 className="text-base font-semibold text-foreground">Ready-made alerts</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">WayTara watches these for you. The ones marked On are on for everyone from the start; switch any off, or change its limit.</p>
        </div>
        <div className="space-y-5 px-5 pb-5 sm:px-6">
          {groups.map(({ group, items }) => (
            <div key={group}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group}</p>
              <ul className="divide-y divide-border rounded-lg border border-border">
                {items.map((r) => (
                  <AlertRow key={r.key} rule={r} sites={sites} onToggle={(v) => void toggle(r, v)} onEdit={() => setEditing({ rule: r })} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {editing && <AlertDialog rule={editing.rule} sites={sites} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); router.refresh(); }} />}
    </div>
  );
}

function AlertRow({ rule, sites, onToggle, onEdit }: { rule: EffectiveRule; sites: AlertSite[]; onToggle: (on: boolean) => void; onEdit: () => void }) {
  const preset = rule.presetId ? presetOf(rule.presetId) : null;
  const siteName = rule.siteId ? sites.find((s) => s.id === rule.siteId)?.name : null;
  return (
    <li className="flex items-center gap-3 px-3.5 py-3">
      <span className={cn("size-2.5 shrink-0 rounded-full", SEVERITY_DOT[rule.severity], !rule.enabled && "opacity-30")} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm font-medium", rule.enabled ? "text-foreground" : "text-muted-foreground")}>{rule.title}</p>
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <span className="truncate">{preset?.hint ?? (rule.siteId ? siteName ?? "One site" : "All my sites")}</span>
          {rule.email && <Mail className="size-3" aria-label="E-mail" />}
          {rule.app && <Smartphone className="size-3" aria-label="In the app" />}
          {rule.presetId && rule.untouched && rule.enabled && <span className="rounded-full bg-emerald-500/15 px-1.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">On by default</span>}
        </p>
      </div>
      <Button type="button" variant="outline" size="icon" className="size-8 shrink-0" aria-label={`Edit ${rule.title}`} onClick={onEdit}>
        <Pencil className="size-3.5" />
      </Button>
      <Switch checked={rule.enabled} onCheckedChange={onToggle} aria-label={`${rule.title} on or off`} />
    </li>
  );
}

function AlertDialog({ rule, sites, onClose, onSaved }: { rule: EffectiveRule | null; sites: AlertSite[]; onClose: () => void; onSaved: () => void }) {
  const preset = rule?.presetId ? presetOf(rule.presetId) : null;
  const [name, setName] = React.useState(rule && !rule.presetId ? (rule.title === rule.metric ? "" : rule.title) : "");
  const [metric, setMetric] = React.useState(rule?.metric ?? "battery_soc");
  const [op, setOp] = React.useState<Op>(rule?.op ?? metricOf("battery_soc")!.starter.op);
  const [limit, setLimit] = React.useState(String(rule?.threshold ?? metricOf("battery_soc")!.starter.threshold));
  const [siteId, setSiteId] = React.useState<string>(rule?.siteId ?? "all");
  const [email, setEmail] = React.useState(rule?.email ?? true);
  const [app, setApp] = React.useState(rule?.app ?? true);
  const [cooldown, setCooldown] = React.useState(String(rule?.cooldownMinutes ?? 60));
  const [saving, setSaving] = React.useState(false);

  const m = metricOf(metric);
  const threshold = Number(limit);
  const valid = !!m && limit.trim() !== "" && Number.isFinite(threshold) && (email || app);

  function chooseMetric(id: string) {
    setMetric(id);
    const next = metricOf(id);
    if (next) {
      setOp(next.starter.op);
      setLimit(String(next.starter.threshold));
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const ok = await withPromiseToast(saveAlertRule, { loading: "Saving…", success: "Alert saved." })({
      id: rule && !rule.presetId ? rule.ruleId : null,
      presetId: rule?.presetId ?? null,
      name,
      metric,
      op,
      threshold,
      siteId: siteId === "all" ? null : siteId,
      email,
      app,
      cooldownMinutes: Number(cooldown),
      enabled: true,
    });
    setSaving(false);
    if (ok) onSaved();
  }

  async function remove() {
    if (!rule?.ruleId) return;
    setSaving(true);
    const ok = await withPromiseToast(deleteAlertRule, { loading: "Removing…", success: rule.presetId ? "Back to the default." : "Alert deleted." })(rule.ruleId);
    setSaving(false);
    if (ok) onSaved();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BellRing className="size-4" />
            {rule ? (preset ? "Change this alert" : "Edit your alert") : "New alert"}
          </DialogTitle>
          <DialogDescription>{preset ? preset.hint : "Choose what to watch and the limit. You are told once when it is crossed, not every few minutes."}</DialogDescription>
        </DialogHeader>

        <form onSubmit={save} className="space-y-4">
          {!preset && (
            <FieldRow label="Name (optional)" htmlFor="alertName">
              <Input id="alertName" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="e.g. Evening battery" />
            </FieldRow>
          )}

          <FieldRow label="Tell me when">
            {preset ? (
              <p className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-foreground">{m?.label}</p>
            ) : (
              <Select value={metric} onValueChange={chooseMetric}>
                <SelectTrigger aria-label="What to watch">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {METRIC_GROUPS.map((g: MetricGroup) => (
                    <SelectGroup key={g}>
                      <SelectLabel>{g}</SelectLabel>
                      {METRICS.filter((x) => x.group === g).map((x) => (
                        <SelectItem key={x.id} value={x.id}>
                          {x.label} ({x.unit})
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FieldRow>

          <div className="grid grid-cols-[8rem_1fr] gap-3">
            <FieldRow label="Is">
              {preset ? (
                <p className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm capitalize text-foreground">{op}</p>
              ) : (
                <Select value={op} onValueChange={(v) => setOp(v as Op)}>
                  <SelectTrigger aria-label="Above or below">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="below">Below</SelectItem>
                    <SelectItem value="above">Above</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </FieldRow>
            <FieldRow label={`Limit${m ? ` (${m.unit})` : ""}`} htmlFor="alertLimit" hint={m && valid ? `For example: ${m.label} ${op} ${formatLimit(m, threshold)}` : undefined}>
              <Input id="alertLimit" type="number" inputMode="decimal" step="any" value={limit} onChange={(e) => setLimit(e.target.value)} />
            </FieldRow>
          </div>

          {!preset && sites.length > 1 && (
            <FieldRow label="Where">
              <Select value={siteId} onValueChange={setSiteId}>
                <SelectTrigger aria-label="Which site">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All my sites</SelectItem>
                  {sites.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldRow>
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Tell me by</p>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={email} onCheckedChange={(v) => setEmail(v === true)} />
              <Mail className="size-3.5 text-muted-foreground" />
              E-mail
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={app} onCheckedChange={(v) => setApp(v === true)} />
              <Smartphone className="size-3.5 text-muted-foreground" />
              The bell in the app
            </label>
            {!email && !app && <p className="text-xs text-destructive">Choose at least one.</p>}
          </div>

          <FieldRow label="Do not repeat more often than">
            <Select value={cooldown} onValueChange={setCooldown}>
              <SelectTrigger aria-label="How often it may repeat">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COOLDOWN_CHOICES.map((c) => (
                  <SelectItem key={c.minutes} value={String(c.minutes)}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>

          <DialogFooter className="gap-2 sm:justify-between">
            {rule?.ruleId ? (
              <Button type="button" variant="outline" disabled={saving} onClick={() => void remove()} className="text-destructive hover:text-destructive">
                {preset ? "Back to default" : "Delete"}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={!valid || saving}>
                <ButtonSpinner show={saving} />
                Save
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
