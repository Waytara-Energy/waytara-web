"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { cn } from "@waytara/ui/cn";

/** Ported from apps/web's ui/submit-button.tsx — reads the nearest
 *  ancestor `<form action={...}>`'s in-flight state via `useFormStatus`,
 *  so no `pending` prop needs threading down.
 *
 *  Renders its own markup rather than wrapping @waytara/ui's `Button` —
 *  that component's variants don't include the gradient look apps/web
 *  uses on its login page, and layering an override on top of a variant
 *  class (e.g. `hover:bg-accent`) fights it under tailwind-merge. This
 *  is the exact class string web's <Button variant="gradient" /> resolves
 *  to, gradient colors matched from its globals.css --gradient-primary
 *  (light/dark) since that CSS variable isn't part of admin's shared
 *  token set. */
export function SubmitButton({
  children,
  pendingText,
  disabled,
  className,
}: {
  children: React.ReactNode;
  pendingText?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200",
        "h-11 px-5 py-2.5 text-white shadow-sm border-0",
        "bg-[linear-gradient(135deg,#34D399_0%,#16A34A_50%,#15803D_100%)]",
        "dark:bg-[linear-gradient(135deg,#34D399_0%,#16A34A_50%,#0D9488_100%)]",
        "hover:brightness-95 hover:shadow-md hover:scale-[1.01] active:scale-[0.99]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer",
        className
      )}
    >
      {pending && <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />}
      {pending && pendingText !== undefined ? pendingText : children}
    </button>
  );
}
