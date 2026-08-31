import { Button } from "@waytara/ui/button";

export default function DashboardPage() {
  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Basic shell — sidebar nav is wired up, section pages aren&apos;t
          built yet.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        Leads, Onboarding, Customers, Employees, and Plans each need a real
        page under <code className="text-foreground">src/app/(dashboard)</code>.
      </div>

      <Button variant="outline" size="sm" disabled>
        Nothing to do here yet
      </Button>
    </div>
  );
}
