import * as React from "react";

// The standard hydration-safe "has this component mounted on the client
// yet" check (needed before reading anything only known post-hydration,
// e.g. next-themes' resolved theme) — useSyncExternalStore instead of the
// once-common useState+useEffect(() => setMounted(true)) pattern, since
// that pattern calls setState synchronously on mount, which triggers an
// avoidable extra render. getSnapshot/getServerSnapshot differing (true
// vs false) is exactly what produces "false" for the server/first-paint
// render and "true" for every client render after, with no subscription
// ever needed (the answer never changes again once mounted).
function subscribe() {
  return () => {};
}
function getSnapshot() {
  return true;
}
function getServerSnapshot() {
  return false;
}

export function useHasMounted(): boolean {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
