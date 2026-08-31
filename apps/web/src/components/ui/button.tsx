import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer",
  {
    variants: {
      variant: {
        gradient:
          "bg-primary-gradient text-white shadow-sm hover:brightness-95 hover:shadow-md hover:scale-[1.01] active:scale-[0.99] border-0 font-semibold",
        "gradient-outline":
          "relative border border-emerald-500/40 bg-theme-surface hover:bg-theme-surface-hover text-theme-highlight font-semibold hover:border-emerald-500 transition-all",
        default:
          "bg-theme-primary text-theme-bg hover:opacity-90 active:scale-[0.99]",
        secondary:
          "bg-theme-surface text-theme-primary border border-theme-border hover:bg-theme-surface-hover hover:border-emerald-500/30",
        outline:
          "border border-theme-border bg-transparent text-theme-primary hover:bg-theme-surface hover:border-theme-border",
        ghost:
          "hover:bg-theme-surface text-theme-primary hover:text-theme-highlight",
        link:
          "text-theme-highlight underline-offset-4 hover:underline p-0 h-auto",
      },
      size: {
        default: "h-11 px-5 py-2.5",
        sm: "h-9 rounded-lg px-3.5 text-xs",
        lg: "h-13 rounded-2xl px-7 text-base font-semibold",
        icon: "h-10 w-10 p-0",
      },
    },
    defaultVariants: {
      variant: "gradient",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
