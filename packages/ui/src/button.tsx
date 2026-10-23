"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:opacity-90",
        secondary:
          "bg-secondary text-secondary-foreground border border-border hover:bg-accent",
        outline:
          "border border-border bg-transparent text-foreground hover:bg-accent",
        ghost: "hover:bg-accent text-foreground",
        destructive:
          "bg-destructive text-destructive-foreground hover:opacity-90",
        link: "text-primary underline-offset-4 hover:underline p-0 h-auto",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-sm px-3 text-xs",
        lg: "h-11 rounded-lg px-6",
        icon: "h-9 w-9 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Spinner = () => <span aria-hidden className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />;

/**
 * A button. A submit button inside a form whose action is running (a server action) disables itself and shows a spinner until the action is
 * done, so a double click cannot send the form twice. Every other button, and a form that is not running an action, behaves as before.
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, children, disabled, ...props }, ref) => {
    const { pending } = useFormStatus();
    const submitting = pending && !asChild && props.type === "submit";
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || submitting}
        aria-busy={submitting || undefined}
        {...props}
      >
        {/* with asChild the child is the element: it must stay the only child */}
        {asChild ? (
          children
        ) : (
          <>
            {submitting && <Spinner />}
            {children}
          </>
        )}
      </Comp>
    );
  }
);
Button.displayName = "Button";

/** A small text-style submit button (a "Remove" or "Cancel" link inside a form): disabled while the form's action runs, and its text can change. */
function TextSubmit({ children, pendingText, className, ...props }: Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type"> & { pendingText?: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || props.disabled} aria-busy={pending || undefined} className={cn("disabled:pointer-events-none disabled:opacity-50", className)} {...props}>
      {pending && pendingText !== undefined ? pendingText : children}
    </button>
  );
}

export { Button, TextSubmit, buttonVariants };
