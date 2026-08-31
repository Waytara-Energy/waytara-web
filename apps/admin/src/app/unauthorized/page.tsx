import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@waytara/ui/button";

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
      <ShieldAlert className="h-8 w-8 text-destructive" />
      <h1 className="text-xl font-semibold">You don&apos;t have access to this page</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Your account doesn&apos;t have the role required for this section.
        Contact an admin if you think this is wrong.
      </p>
      <Button asChild size="sm" className="mt-2">
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
    </div>
  );
}
