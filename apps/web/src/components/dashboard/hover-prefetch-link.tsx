"use client";

import * as React from "react";
import Link from "next/link";

/**
 * A link that loads the page behind it ahead of the click only once the pointer, the keyboard or a finger shows interest in it, instead of as soon as it
 * appears on screen. The dashboard's pages are rendered on the server and take a moment each, so loading every menu entry's page the instant the dashboard
 * opens meant several heavy renders at once, right when the person is waiting for the page they asked for. This is the pattern the framework's own
 * prefetching guide gives for links that should wait for intent.
 */
export function HoverPrefetchLink({ onMouseEnter, onFocus, onTouchStart, ...props }: React.ComponentProps<typeof Link>) {
  const [wanted, setWanted] = React.useState(false);
  return (
    <Link
      {...props}
      prefetch={wanted ? null : false}
      onMouseEnter={(e) => {
        setWanted(true);
        onMouseEnter?.(e);
      }}
      onFocus={(e) => {
        setWanted(true);
        onFocus?.(e);
      }}
      onTouchStart={(e) => {
        setWanted(true);
        onTouchStart?.(e);
      }}
    />
  );
}
