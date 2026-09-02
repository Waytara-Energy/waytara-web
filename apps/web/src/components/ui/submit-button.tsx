"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/ui/spinner";

/** A submit button that knows its own form's in-flight state —
 *  `useFormStatus` reads the nearest ancestor `<form action={...}>`
 *  automatically, so no `pending` prop needs threading down from
 *  whatever page renders the form. Disables itself and shows a spinner
 *  the instant the server action starts, re-enables when it redirects or
 *  returns. Drop-in replacement for `<Button type="submit">`. */
export function SubmitButton({
  children,
  pendingText,
  disabled,
  ...props
}: ButtonProps & { pendingText?: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled} {...props}>
      <ButtonSpinner show={pending} />
      {pending && pendingText !== undefined ? pendingText : children}
    </Button>
  );
}
