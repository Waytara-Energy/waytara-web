"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/** The submit button of a shadcn-designed form: disabled and spinning while the form's action runs (it reads the nearest form's state, so nothing is passed down). */
export function FormSubmit({
  children,
  pendingText,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "type"> & { pendingText?: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} aria-busy={pending || undefined} {...props}>
      {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
      {pending && pendingText !== undefined ? pendingText : children}
    </Button>
  );
}
