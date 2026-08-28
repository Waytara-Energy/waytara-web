import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  isLink?: boolean;
  variant?: "default" | "white";
}

export function Logo({ className, isLink = true }: LogoProps) {
  const content = (
    <div className={cn("inline-flex items-center select-none group", className)}>
      <Image
        src="/images/logo.png"
        alt="WayTara Logo"
        width={180}
        height={48}
        priority
        unoptimized
        className="h-[clamp(1.6rem,2.2vw,2.1rem)] w-auto object-contain transition-opacity duration-200 group-hover:opacity-90"
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
