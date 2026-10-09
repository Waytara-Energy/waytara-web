"use client";

import * as React from "react";

const subscribeHash = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};

let lastHash = "";
const readHash = () => {
  const h = window.location.hash.replace("#", "");
  if (h) lastHash = h;
  return h || lastHash;
};

/** The open tab, kept in the address (#health) so a reload or a copied link opens the same one. A refresh after saving something can
 *  drop the hash; an empty hash that follows a real one is that refresh, so the tab stays where it was (forgotten again on leaving). */
export function useHashTab<T extends string>(ids: readonly T[], fallback: T): [T, (id: T) => void] {
  const hash = React.useSyncExternalStore(subscribeHash, readHash, () => "");
  const section = (ids as readonly string[]).includes(hash) ? (hash as T) : fallback;
  React.useEffect(() => {
    if (hash && !window.location.hash) window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}#${hash}`);
  });
  React.useEffect(() => () => void (lastHash = ""), []);
  return [section, (id) => void (window.location.hash = id)];
}
