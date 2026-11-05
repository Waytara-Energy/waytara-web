import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  isLink?: boolean;
  variant?: "default" | "white";
}

export function Logo({ className, isLink = true, variant = "default" }: LogoProps) {
  const content = (
    <div className={cn("inline-flex items-center select-none group", className)}>
      <Image
        src="/images/logo.png"
        alt="WayTara Logo"
        width={180}
        height={48}
        priority
        // "white" is for a logo over a photo or a dark sky: every colour of the artwork (the green gradient and the black "ENERGY") turns white.
        className={cn(
          "h-[clamp(1.6rem,2.2vw,2.1rem)] w-auto object-contain transition-[opacity,filter] duration-200 group-hover:opacity-90",
          variant === "white" && "brightness-0 invert"
        )}
      />
    </div>
  );

  if (!isLink) return content;

  return (
    <Link
      href="/"
      className="focus:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 rounded flex items-center"
      aria-label="WayTara Home"
    >
      {content}
    </Link>
  );
}

/** The icon-only brand mark (no wordmark) — for spots too narrow for the
 *  full `Logo`, e.g. a collapsed sidebar rail or an app icon/favicon. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <Image
      src="/images/icon.png"
      alt="WayTara"
      width={64}
      height={64}
      className={cn("object-contain", className)}
    />
  );
}
