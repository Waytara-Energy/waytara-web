import Link from "next/link";
import {
  Users,
  ClipboardCheck,
  UserCircle2,
  UsersRound,
  Layers,
  Zap,
} from "lucide-react";
import { cn } from "@waytara/ui/cn";

const NAV_ITEMS = [
  { label: "Leads", href: "/leads", icon: Users },
  { label: "Onboarding", href: "/onboarding", icon: ClipboardCheck },
  { label: "Customers", href: "/customers", icon: UserCircle2 },
  { label: "Employees", href: "/employees", icon: UsersRound },
  { label: "Plans", href: "/plans", icon: Layers },
] as const;

export function Sidebar() {
  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-border bg-card">
      <div className="flex h-16 items-center gap-2 border-b border-border px-5">
        <Zap className="h-5 w-5 text-primary" />
        <span className="text-sm font-semibold tracking-tight">
          WayTara Admin
        </span>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors",
              "hover:bg-accent hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="border-t border-border p-3 text-xs text-muted-foreground">
        No real pages wired up yet — nav stub only.
      </div>
    </aside>
  );
}
