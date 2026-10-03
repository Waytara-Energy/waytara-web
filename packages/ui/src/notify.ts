"use client";

import { toast as sonnerToast } from "sonner";

/** Shared across both apps (customer dashboard + admin) so every
 *  in-product message — save confirmations, form errors, create/delete
 *  results, background job outcomes — goes through one consistent toast
 *  system instead of a one-off inline banner some pages had and others
 *  didn't. Mount <Toaster richColors position="bottom-right" /> once per
 *  app (see components/ui/sonner.tsx in each) and call these instead of
 *  rendering a success/error <Alert> in the page itself.
 *
 *  Two shapes, both covered by the same richColors icon+color styling
 *  from <Toaster>:
 *   - Routine feedback (the default): has a close button, so a customer
 *     or admin can dismiss it the moment they've read it, on top of its
 *     own auto-hide timer.
 *   - `important: true`: no close button — it can only be dismissed by
 *     letting it run out (or by hovering it, which pauses the countdown
 *     — Sonner's own built-in behavior, nothing custom needed here — and
 *     resumes, then hides, once the pointer leaves). Reserve this for a
 *     message that must actually be read, not skimmed past by reflex. */
export interface NotifyOptions {
  description?: string;
  /** No close button; otherwise behaves exactly like a routine toast
   *  (auto-hides on its own timer, hover pauses that timer). */
  important?: boolean;
  /** Milliseconds before auto-hide. Sonner's own default (~4s, longer for
   *  description-bearing toasts) applies when omitted. */
  duration?: number;
  /** A click target alongside the message, e.g. {label: "Undo", onClick}. */
  action?: { label: string; onClick: () => void };
}

function toSonnerOptions(options?: NotifyOptions) {
  return {
    description: options?.description,
    closeButton: !options?.important,
    duration: options?.duration,
    action: options?.action,
  };
}

/** Wraps a Server Action so it can be dropped straight into
 *  `<form action={withPromiseToast(myAction.bind(null, id), {...})}>` and
 *  get a loading → success/error Sonner toast for free, instead of a
 *  static toast that only appears after a `redirect()`-driven navigation
 *  lands. React tracks `pending` via `useFormStatus()` for *any* async
 *  function passed as a form's `action` — not only a literal `'use server'`
 *  reference — so `SubmitButton` keeps working unchanged underneath this.
 *
 *  The wrapped action must actually REJECT to report failure. A Server
 *  Action that reports its own errors by calling `redirect(path +
 *  "?error=...")` won't work here: `redirect()` is a control-flow signal,
 *  not a rejection, so a toast.promise wrapped around it would show
 *  "success" on an error redirect too. Convert the action's error path to
 *  `throw new Error(message)` (or return an `{ error }` shape and throw
 *  from the caller) before wrapping it. A success path that itself calls
 *  `redirect()` to a *different* page is fine as-is — the navigation and
 *  the toast are independent of each other.
 *
 *  Resolves to whether the action succeeded, instead of rethrowing — a
 *  bare `<form action={...}>` ignores that return value entirely, but a
 *  caller that needs to react to the outcome itself (closing a dialog only
 *  on success, say) can `await` the wrapped function directly. Either way
 *  the rejection never reaches the caller uncaught — it's already been
 *  surfaced as the error toast. */
export function withPromiseToast<Args extends unknown[], T>(
  action: (...args: Args) => Promise<T>,
  messages: {
    loading: string;
    /** A fixed line, or — for an action whose outcome isn't just "it
     *  worked" (e.g. "Cloned 4 registers.") — a function of its resolved
     *  value. */
    success: string | ((value: T) => string);
    /** Defaults to the rejection's own message, falling back to a generic
     *  line for a non-Error throw. */
    error?: (error: unknown) => string;
  }
) {
  return async (...args: Args): Promise<boolean> => {
    const promise = action(...args);
    notify.promise(promise, {
      loading: messages.loading,
      success: typeof messages.success === "function" ? messages.success : () => messages.success as string,
      error: messages.error ?? ((e) => (e instanceof Error ? e.message : "Something went wrong.")),
    });
    try {
      await promise;
      return true;
    } catch {
      return false;
    }
  };
}

export const notify = {
  /** Plain/neutral message — no success/error implication. */
  default: (message: string, options?: NotifyOptions) => sonnerToast(message, toSonnerOptions(options)),
  success: (message: string, options?: NotifyOptions) => sonnerToast.success(message, toSonnerOptions(options)),
  info: (message: string, options?: NotifyOptions) => sonnerToast.info(message, toSonnerOptions(options)),
  warning: (message: string, options?: NotifyOptions) => sonnerToast.warning(message, toSonnerOptions(options)),
  error: (message: string, options?: NotifyOptions) => sonnerToast.error(message, toSonnerOptions(options)),
  /** Three-phase toast for an in-flight async action — same shape as
   *  sonner's own toast.promise, re-exported here so every call site
   *  imports toast handling from one place. Always has a close button
   *  once settled (never `important`), since there's nothing time-
   *  critical about a background task's own outcome. */
  promise: sonnerToast.promise,
  /** Escape hatch for anything the typed helpers above don't cover —
   *  the raw sonner toast function, for a call site that needs an option
   *  (e.g. a custom id to update/replace a toast in place) this module
   *  doesn't expose yet. */
  raw: sonnerToast,
};
