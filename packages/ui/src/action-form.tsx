"use client";

import type { FormHTMLAttributes, ReactNode } from "react";
import { withPromiseToast } from "./notify";

/** A `<form>` whose `action` is a Server Action, wrapped so submitting it
 *  shows a loading → success/error Sonner toast (see `withPromiseToast`).
 *  Exists so a page that defines its fields in a Server Component (the
 *  common case — `action={...}` itself has to be wired up in client code
 *  since `withPromiseToast` calls Sonner, but the server-rendered field
 *  markup composes straight through as `children`, no need to also move
 *  the whole form into a Client Component) can opt a plain
 *  `<form action={myAction.bind(null, id)}>` into the toast pattern by
 *  swapping the tag and adding `loading`/`success` text — every prop below
 *  `action`/`loading`/`success` passes straight through to the underlying
 *  `<form>` unchanged. `action` must reject (throw) to report failure —
 *  see `withPromiseToast`'s own note on why a `redirect()`-based error
 *  path won't work here. */
export function ActionForm({
  action,
  loading,
  success,
  error,
  children,
  ...formProps
}: {
  action: (formData: FormData) => Promise<unknown>;
  loading: string;
  success: string;
  error?: (error: unknown) => string;
  children: ReactNode;
} & Omit<FormHTMLAttributes<HTMLFormElement>, "action" | "children">) {
  const submit = withPromiseToast(action, { loading, success, error });
  return (
    <form
      action={async (formData: FormData) => {
        await submit(formData);
      }}
      {...formProps}
    >
      {children}
    </form>
  );
}
