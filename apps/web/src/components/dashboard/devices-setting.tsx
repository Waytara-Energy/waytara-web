"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CircleHelp, Laptop, LogOut, Monitor, ShieldCheck, Smartphone, Tablet, type LucideIcon } from "lucide-react";
import { withPromiseToast } from "@waytara/ui/notify";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { activeText, describeDevice, type DeviceKind } from "@/lib/user-agent";
import { cn } from "@/lib/utils";
import { revokeSession, signOutAllDevices, signOutOtherDevices } from "@/app/dashboard/settings/actions";

export interface SignedInDevice {
  id: string;
  lastActive: string;
  createdAt: string;
  userAgent: string | null;
  ip: string | null;
  isCurrent: boolean;
}

const ICON: Record<DeviceKind, LucideIcon> = { phone: Smartphone, tablet: Tablet, desktop: Laptop, unknown: CircleHelp };

const signedIn = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** Application Settings: where this account is signed in. Each device shows what it is, where from, and when it was last used; any other
 *  can be signed out on its own, all the others at once, or every device including this one. Signing out here never signs out the rest. */
export function DevicesSetting({ devices, now }: { devices: SignedInDevice[]; now: number }) {
  const others = devices.filter((d) => !d.isCurrent);
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<void>, loading: string, success: string, after?: () => void) => {
    setBusy(key);
    const ok = await withPromiseToast(fn, { loading, success })();
    setBusy(null);
    if (ok) after?.();
  };

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <ShieldCheck className="size-5" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-foreground">Devices &amp; sessions</h2>
          <p className="mt-1 text-xs text-muted-foreground">Where you are signed in. If you do not recognise a device, sign it out and change your password.</p>
        </div>
      </div>

      {devices.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">No sign-ins to show.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {devices.map((d) => {
            const info = describeDevice(d.userAgent);
            const Icon = d.isCurrent && info.kind === "unknown" ? Monitor : ICON[info.kind];
            return (
              <li key={d.id} className="flex items-center gap-3 px-3.5 py-3">
                <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", d.isCurrent ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground")}>
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="truncate text-sm font-medium text-foreground">{info.label}</p>
                    {d.isCurrent && <Badge className="px-2 py-0 text-[11px]">This device</Badge>}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {d.isCurrent ? "Active now" : activeText(d.lastActive, now)}
                    {d.ip ? ` · ${d.ip}` : ""}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">Signed in {signedIn(d.createdAt)}</p>
                </div>
                {!d.isCurrent && (
                  <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => void run(d.id, () => revokeSession(d.id), "Signing out…", "Device signed out.")}>
                    <LogOut className="size-3.5" />
                    Sign out
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" disabled={others.length === 0 || busy !== null}>
              Sign out of other devices
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Sign out of your other devices?</AlertDialogTitle>
              <AlertDialogDescription>
                {others.length === 1 ? "The other device" : `The other ${others.length} devices`} will be asked to sign in again. You stay signed in here.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => void run("others", signOutOtherDevices, "Signing out…", "Other devices signed out.")}>Sign out others</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" disabled={busy !== null} className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive">
              Sign out of all devices
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Sign out of every device?</AlertDialogTitle>
              <AlertDialogDescription>This ends all your sessions, including this one. You will need to sign in again everywhere.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => void run("all", signOutAllDevices, "Signing out…", "Signed out everywhere.", () => router.replace("/login"))}>Sign out everywhere</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </section>
  );
}
