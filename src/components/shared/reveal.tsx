"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Direction = "up" | "down" | "left" | "right" | "fade" | "zoom";

interface RevealProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  direction?: Direction;
  delay?: number; // In milliseconds
  duration?: number; // In milliseconds
  threshold?: number;
  once?: boolean;
  blur?: boolean;
  distance?: number; // In pixels
  className?: string;
}

export function Reveal({
  children,
  direction = "up",
  delay = 0,
  duration = 700,
  threshold = 0.15,
  once = true,
  blur = true,
  distance = 32,
  className,
  style,
  ...props
}: RevealProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = React.useState(false);

  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (once) {
            observer.unobserve(element);
          }
        } else if (!once) {
          setIsVisible(false);
        }
      },
      {
        threshold,
        rootMargin: "0px 0px -40px 0px",
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [threshold, once]);

  const getInitialTransform = () => {
    switch (direction) {
      case "up":
        return `translate3d(0, ${distance}px, 0)`;
      case "down":
        return `translate3d(0, -${distance}px, 0)`;
      case "left":
        return `translate3d(${distance}px, 0, 0)`;
      case "right":
        return `translate3d(-${distance}px, 0, 0)`;
      case "zoom":
        return "scale3d(0.92, 0.92, 1)";
      case "fade":
      default:
        return "translate3d(0, 0, 0)";
    }
  };

  return (
    <div
      ref={ref}
      className={cn(className)}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translate3d(0, 0, 0) scale3d(1, 1, 1)" : getInitialTransform(),
        filter: blur ? (isVisible ? "blur(0px)" : "blur(8px)") : undefined,
        transitionProperty: "opacity, transform, filter",
        transitionDuration: `${duration}ms`,
        transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
        transitionDelay: `${delay}ms`,
        willChange: isVisible ? "auto" : "opacity, transform, filter",
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}

interface StaggerContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  staggerDelay?: number;
  direction?: Direction;
  duration?: number;
  threshold?: number;
  className?: string;
}

export function StaggerContainer({
  children,
  staggerDelay = 100,
  direction = "up",
  duration = 650,
  threshold = 0.15,
  className,
  ...props
}: StaggerContainerProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = React.useState(false);

  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(element);
        }
      },
      {
        threshold,
        rootMargin: "0px 0px -40px 0px",
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [threshold]);

  return (
    <div ref={ref} className={className} {...props}>
      {React.Children.map(children, (child, idx) => {
        if (!React.isValidElement(child)) return child;

        return (
          <Reveal
            direction={direction}
            delay={idx * staggerDelay}
            duration={duration}
            blur={true}
          >
            {child}
          </Reveal>
        );
      })}
    </div>
  );
}
