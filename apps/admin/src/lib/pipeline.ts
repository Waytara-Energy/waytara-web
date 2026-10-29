import type { Tone } from "@/components/page-kit";

/** The statuses a lead goes through, in order. */
export const LEAD_STATUSES = ["new", "assigned", "quoted", "converted", "lost"] as const;

/** The stages of the onboarding pipeline, in order, with how each reads and its colour. (Not in a client file: server pages read it too.) */
export const STAGES: { value: string; label: string; tone: Tone }[] = [
  { value: "quotation_sent", label: "Quotation sent", tone: "info" },
  { value: "quotation_accepted", label: "Quotation accepted", tone: "info" },
  { value: "payment_pending", label: "Payment pending", tone: "warn" },
  { value: "account_created", label: "Account created", tone: "violet" },
  { value: "site_setup", label: "Site setup", tone: "violet" },
  { value: "connection_test", label: "Connection test", tone: "violet" },
  { value: "install_scheduled", label: "Install scheduled", tone: "warn" },
  { value: "install_completed", label: "Install completed", tone: "good" },
];
