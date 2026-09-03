import { Receipt } from "lucide-react";
import { createClient } from "@waytara/supabase/server";
import { getRequestProfile } from "@/lib/request-profile";
import { RealtimeRefresh } from "@/components/dashboard/realtime-refresh";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const PAYMENT_STATUS_BADGE_VARIANT: Record<string, "default" | "alert" | "secondary"> = {
  paid: "default",
  pending: "alert",
  failed: "alert",
  refunded: "secondary",
};

export default async function BillingPage() {
  const profile = await getRequestProfile();
  const supabase = await createClient();

  const { data: customer } = profile
    ? await supabase
        .from("customers")
        .select("status, plan_started_at, plan:plans(name, price_monthly, price_yearly)")
        .eq("id", profile.id)
        .maybeSingle()
    : { data: null };

  const { data: subscription } = profile
    ? await supabase
        .from("subscriptions")
        .select("status, current_period_start, current_period_end")
        .eq("customer_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const { data: payments } = await supabase
    .from("payments")
    .select("id, payment_type, amount, status, paid_at, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-2xl space-y-6">
      {profile && <RealtimeRefresh table="payments" event="UPDATE" filter={`customer_id=eq.${profile.id}`} />}
      <div>
        <h1 className="text-2xl font-semibold text-theme-primary">Billing &amp; Plan</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Current Plan</CardTitle>
          </CardHeader>
          <CardContent>
            {customer?.plan ? (
              <div className="text-sm">
                <p className="text-foreground">
                  {customer.plan.name} — ₹{Number(customer.plan.price_monthly).toLocaleString("en-IN")} one-time
                </p>
                <p className="mt-1 text-muted-foreground">
                  Active since{" "}
                  {customer.plan_started_at
                    ? new Date(customer.plan_started_at).toLocaleDateString("en-IN")
                    : "—"}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No plan assigned yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Subscription</CardTitle>
            <CardDescription>Ongoing monitoring &amp; dashboard access</CardDescription>
          </CardHeader>
          <CardContent>
            {subscription ? (
              <Badge variant={subscription.status === "active" ? "default" : "secondary"} className="capitalize">
                {subscription.status}
              </Badge>
            ) : (
              <p className="text-sm text-muted-foreground">No subscription record yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          {!payments || payments.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Receipt />
                </EmptyMedia>
                <EmptyTitle>No payments yet</EmptyTitle>
                <EmptyDescription>Payments you make will show up here.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="capitalize text-foreground">
                        {p.payment_type.replace(/_/g, " ")}
                      </TableCell>
                      <TableCell className="tabular-nums text-foreground">
                        ₹{Number(p.amount).toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(p.paid_at ?? p.created_at).toLocaleDateString("en-IN")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={PAYMENT_STATUS_BADGE_VARIANT[p.status] ?? "secondary"} className="capitalize">
                          {p.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
