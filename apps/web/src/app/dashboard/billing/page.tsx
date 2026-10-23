import { redirect } from "next/navigation";

// Billing & Plan is now the Billing tab of Application Settings; this keeps old links and bookmarks working.
export default function BillingPage() {
  redirect("/dashboard/settings#billing");
}
