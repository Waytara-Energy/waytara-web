"use client";

import { Suspense, useEffect, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { notify } from "@waytara/ui/notify";

/** Reads `?error=`/`?success=` off the current URL, surfaces each as a
 *  Sonner toast instead of an inline banner, then strips both params via a
 *  scroll-preserving replace so a refresh doesn't re-fire the toast. Mirrors
 *  apps/web's own ToastFromSearchParams — kept as a separate local copy
 *  since @waytara/ui has no next dependency (see that component's own note).
 *
 *  `success`'s own URL value is shown verbatim by default (most admin
 *  actions redirect with the real message already encoded in the param).
 *  Pass `successMessage` when the param is just a flag ("1") rather than
 *  real text, or `successMessages` to map the param's value (e.g. an action
 *  slug like "invited") to its display text — a value with no entry shows
 *  nothing, same as the inline banners this replaces. */
function ToastFromSearchParamsInner({
  errorParam = "error",
  successParam = "success",
  successMessage,
  successMessages,
}: {
  errorParam?: string;
  successParam?: string;
  successMessage?: string;
  successMessages?: Record<string, string>;
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

    if (error) {
      notify.error(error, { important: true });
    } else if (success) {
      const text = successMessages ? successMessages[success] : (successMessage ?? success);
      if (text) notify.success(text);
    }

    const next = new URLSearchParams(searchParams.toString());
    next.delete(errorParam);
    next.delete(successParam);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
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
