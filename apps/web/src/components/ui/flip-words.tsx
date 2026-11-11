"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type FlipWordsProps = {
  words: string[];
  /** How long each word stays, in milliseconds (the change itself takes half a second). */
  duration?: number;
  /** Classes for every word (for example a gradient). */
  className?: string;
  /** Show the first word and never change it (for visitors who asked for less motion). */
  still?: boolean;
};

/**
 * A word that is swapped for the next one every few seconds: the old word lifts away and blurs out while the new one rises into its place.
 *
 * All the words sit on top of one another in one grid cell, so the space is always as wide as the longest word and the text around it never shifts.
 * Each word is one element (not one per letter), so a gradient on `className` stays one continuous gradient across the word. The words are hidden
 * from screen readers (put the full sentence somewhere they can read, as the hero does).
 */
export function FlipWords({ words, duration = 2600, className, still = false }: FlipWordsProps) {
  const [state, setState] = React.useState({ current: 0, previous: -1 });

  React.useEffect(() => {
    if (still || words.length < 2) return;
    const timer = setInterval(() => {
      setState((s) => ({ current: (s.current + 1) % words.length, previous: s.current }));
    }, duration);
    return () => clearInterval(timer);
  }, [still, words.length, duration]);

  return (
    <span aria-hidden="true" className="inline-grid align-baseline">
      {words.map((word, i) => {
        const here = i === (still ? 0 : state.current);
        const leaving = !still && i === state.previous;
        return (
          <span
            key={word}
            className={cn(
              "[grid-area:1/1] transition-[opacity,transform,filter] duration-500 ease-out will-change-[opacity,transform,filter]",
              here ? "translate-y-0 opacity-100 blur-0" : leaving ? "-translate-y-[0.35em] opacity-0 blur-[6px]" : "translate-y-[0.35em] opacity-0 blur-[6px]",
              className
            )}
          >
            {word}
          </span>
        );
      })}
    </span>
  );
}
