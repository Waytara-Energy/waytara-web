"use client";

import { Suspense, useEffect, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { notify } from "@waytara/ui/notify";

/** The common shape across this app's server-action forms: on
 *  failure/success, `redirect()` back to the same page with `?error=...`
 *  or `?success=1`, which pages used to render straight into an inline
 *  <Alert>. Drop this in instead (anywhere in the page, it renders
 *  nothing) — it reads those params once on mount, fires the matching
 *  toast, and strips them from the URL so a refresh or a copied link
 *  doesn't replay the same message.
 *
 *  Error toasts are `important` (no close button — it has to actually be
 *  read, not reflex-dismissed next to the button that caused it); success
 *  toasts are routine and dismissible. */
function ToastFromSearchParamsInner({
  errorParam = "error",
  successParam = "success",
  successMessage = "Saved.",
}: {
  errorParam?: string;
  successParam?: string;
  /** Shown when `successParam` is present but carries no message of its
   *  own (e.g. the common `?success=1`) — an error always uses its own
   *  value from `errorParam` instead, never this. */
  successMessage?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const error = searchParams.get(errorParam);
  const success = searchParams.get(successParam);
  // Dev-only React Strict Mode mounts effects twice (setup → cleanup →
  // setup again, state preserved across the pair) to surface exactly this
  // kind of bug — without this guard the second setup fired the same toast
  // a second time. Keyed by the actual param values, not a bare boolean, so
  // a genuinely new error/success after a later save still shows.
  const shownForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!error && !success) return;
    const key = `${error ?? ""}|${success ?? ""}`;
    if (shownForRef.current === key) return;
    shownForRef.current = key;

    if (error) notify.error(error, { important: true });
    else if (success) notify.success(successMessage);

    const next = new URLSearchParams(searchParams.toString());
    next.delete(errorParam);
    next.delete(successParam);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // Only re-fire when the params this instance actually watches change —
    // not on every searchParams identity change from unrelated state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error, success]);

  return null;
}

type ToastFromSearchParamsProps = React.ComponentProps<typeof ToastFromSearchParamsInner>;

/** useSearchParams() forces a client-side render bailout, so Next requires
 *  a Suspense boundary above it or static prerender of the page fails.
 *  Wrapped here once so every page can drop this in without its own. */
export function ToastFromSearchParams(props: ToastFromSearchParamsProps) {
  return (
    <Suspense fallback={null}>
      <ToastFromSearchParamsInner {...props} />
    </Suspense>
  );
}
