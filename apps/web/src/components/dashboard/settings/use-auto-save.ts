"use client";

import * as React from "react";
import { notify } from "@waytara/ui/notify";

/**
 * A setting that saves itself the moment it is changed (a switch, a choice, a button), so it needs no Save button. `update` shows the change at
 * once and sends it to the server; saves go one after another, each carrying the latest value, so quick changes cannot arrive out of order. When
 * a save fails the setting goes back to what was last saved and an error says so. A short "Saved." confirms the rest. Text that a person types
 * and then commits still belongs in a form with its own Save button.
 */
export function useAutoSave<T>(initial: T, save: (value: T) => Promise<unknown>, options: { onSaved?: (value: T) => void; message?: string } = {}) {
  const [value, setValue] = React.useState(initial);
  const [pending, setPending] = React.useState(0);
  const saved = React.useRef(initial);
  const latest = React.useRef(initial);
  const chain = React.useRef<Promise<void>>(Promise.resolve());
  const fns = React.useRef({ save, onSaved: options.onSaved, message: options.message ?? "Saved." });
  React.useEffect(() => {
    fns.current = { save, onSaved: options.onSaved, message: options.message ?? "Saved." };
  });

  const update = React.useCallback((next: T | ((current: T) => T)) => {
    const resolved = typeof next === "function" ? (next as (current: T) => T)(latest.current) : next;
    latest.current = resolved;
    setValue(resolved);
    setPending((n) => n + 1);
    chain.current = chain.current.then(async () => {
      try {
        await fns.current.save(resolved);
        saved.current = resolved;
        notify.success(fns.current.message, { duration: 1500 });
        fns.current.onSaved?.(resolved);
      } catch (e) {
        latest.current = saved.current;
        setValue(saved.current);
        notify.error(e instanceof Error ? e.message : "Could not save. Try again.");
      } finally {
        setPending((n) => n - 1);
      }
    });
  }, []);

  return { value, update, saving: pending > 0 };
}
