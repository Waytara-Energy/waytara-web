"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@waytara/ui/input";
import { cn } from "@waytara/ui/cn";

// Matches apps/web's ui/input.tsx exactly (h-11, rounded-xl, emerald focus
// ring) — admin's shared @waytara/ui Input defaults to the plainer shadcn
// look (h-10, rounded-md, generic ring) used everywhere else in the
// dashboard, so this only overrides it on these auth-flow fields.
export const AUTH_INPUT_CLASSNAME =
  "h-11 rounded-xl px-4 focus-visible:border-emerald-500 focus-visible:ring-1 focus-visible:ring-emerald-500";

// Ported from apps/web's ui/password-input.tsx, adapted to admin's own
// Input/cn imports — same show/hide-password UX on both apps' login pages.
export const PasswordInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.ComponentProps<"input">, "type">
>(({ className, ...props }, ref) => {
  const [visible, setVisible] = React.useState(false);

  return (
    <div className="relative">
      <Input
        type={visible ? "text" : "password"}
        className={cn(AUTH_INPUT_CLASSNAME, "pr-10", className)}
        ref={ref}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground transition-colors hover:text-foreground"
        tabIndex={-1}
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
});
PasswordInput.displayName = "PasswordInput";
