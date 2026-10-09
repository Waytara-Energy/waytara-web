"use client";

import * as React from "react";

/** A plain `<a href>` download can't be awaited - the browser just starts streaming the response, there's no JS promise that
 *  resolves when it's done. This is a cosmetic-but-honest stand-in: show the spinner for a couple of seconds after the click
 *  (these routes render server-side in well under that), long enough to confirm "yes, that worked" without claiming to know
 *  exactly when the file finished downloading. */
export function useDownloadPending(durationMs = 2200) {
  const [pending, setPending] = React.useState(false);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const trigger = React.useCallback(() => {
    setPending(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setPending(false), durationMs);
  }, [durationMs]);
  React.useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    []
  );
  return [pending, trigger] as const;
}
