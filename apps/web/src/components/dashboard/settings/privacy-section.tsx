"use client";

import Link from "next/link";
import { Download, FileJson, LifeBuoy, ScrollText, ShieldAlert, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { SettingsCard } from "./settings-card";

const INCLUDED = [
  "Your profile, settings and addresses",
  "Your sites and devices",
  "Your alerts, and the alerts that went off",
  "Your support tickets and messages",
  "Your payments and subscription",
  "Your account activity (sign-ins and changes)",
];

/** Settings > Privacy & data: take a copy of your data, read how it is handled, and ask for your account to be deleted. */
export function PrivacySection({ email }: { email: string }) {
  const deletion = new URLSearchParams({
    new: "1",
    category: "account",
    subject: "Please delete my account",
    message: `I would like my WayTara account (${email}) and the data it holds to be deleted. Please tell me what happens to my devices and my warranty, and what you need from me to go ahead.`,
  });
  const about = new URLSearchParams({ new: "1", category: "account", subject: "A question about my data" });

  return (
    <div className="space-y-5">
      <div className="-mb-5 columns-1 gap-5 xl:columns-2 [&>*]:mb-5 [&>*]:break-inside-avoid">
        <SettingsCard
          title="Download my data"
          description="A copy of what WayTara holds for your account, as one file you can keep."
          icon={FileJson}
          tone="sky"
          footer={
            <Button asChild size="sm">
              <a href="/api/account/export" download>
                <Download className="size-3.5" />
                Download my data (JSON)
              </a>
            </Button>
          }
        >
          <ul className="grid gap-1.5 text-sm text-foreground sm:grid-cols-2">
            {INCLUDED.map((i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-sky-500" />
                {i}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">The readings from your devices are not in this file: download them as reports from the Reports page.</p>
        </SettingsCard>

        <SettingsCard title="How your data is handled" description="What we do with it, and who to ask." icon={ScrollText} tone="violet">
          <ul className="-my-1 divide-y divide-border text-sm">
            <li>
              <Link href="/privacy" className="flex items-center justify-between py-3 font-medium text-foreground transition-colors hover:text-emerald-600 dark:hover:text-emerald-400">
                Privacy Policy
                <span className="text-xs font-normal text-muted-foreground">What we collect and why</span>
              </Link>
            </li>
            <li>
              <Link href="/terms" className="flex items-center justify-between py-3 font-medium text-foreground transition-colors hover:text-emerald-600 dark:hover:text-emerald-400">
                Terms of Service
                <span className="text-xs font-normal text-muted-foreground">The agreement</span>
              </Link>
            </li>
            <li>
              <Link href="/cookies" className="flex items-center justify-between py-3 font-medium text-foreground transition-colors hover:text-emerald-600 dark:hover:text-emerald-400">
                Cookie Policy
                <span className="text-xs font-normal text-muted-foreground">What the site stores in your browser</span>
              </Link>
            </li>
          </ul>
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link href={`/dashboard/support?${about}`}>
              <LifeBuoy className="size-3.5" />
              Ask a question about my data
            </Link>
          </Button>
        </SettingsCard>
      </div>

      <section className="overflow-hidden rounded-2xl border border-destructive/40 bg-destructive/5 shadow-sm">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-4 p-5 sm:p-6">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive">
            <ShieldAlert className="size-5" />
          </span>
          <div className="min-w-0 flex-1 basis-72">
            <h2 className="text-base font-semibold text-foreground">Delete my account</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Ask the team to delete your account and the data it holds. Your devices and your warranty are involved, so a person from WayTara replies to you first and nothing is deleted until you confirm.
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive">
                <Trash2 className="size-3.5" />
                Ask for deletion
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Ask for your account to be deleted?</AlertDialogTitle>
                <AlertDialogDescription>
                  This opens a support ticket with your request already written. Nothing is deleted yet: the team replies, explains what happens to your devices and your warranty, and asks you to confirm.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Not now</AlertDialogCancel>
                <AlertDialogAction asChild>
                  <Link href={`/dashboard/support?${deletion}`}>Open the request</Link>
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </section>
    </div>
  );
}
