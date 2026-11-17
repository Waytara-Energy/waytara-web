"use client";

import * as React from "react";
import { ClipboardPaste, Eraser, Loader2 } from "lucide-react";
import { notify } from "@waytara/ui/notify";
import { Button } from "@/components/ui/button";
import { useCountdown } from "@/hooks/use-countdown";
import { extractCode } from "@/lib/otp-code";
import { cn } from "@/lib/utils";

/**
 * Six separate boxes for the 6-digit code that are really one input underneath, so typing, Backspace, pasting (Ctrl+V), the phone's "fill from message" suggestion and a
 * password manager all just work. It is read-only (not disabled) while the code is being checked, so it keeps the keyboard.
 */
export function OtpBoxes({ value, onChange, locked, invalid, autoFocus = true }: { value: string; onChange: (digits: string) => void; locked: boolean; invalid: boolean; autoFocus?: boolean }) {
  const ref = React.useRef<HTMLInputElement>(null);
  const [focused, setFocused] = React.useState(false);
  React.useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);
  const caret = Math.min(value.length, 5);
  return (
    <div className="relative" onClick={() => ref.current?.focus()}>
      <div className="grid grid-cols-6 gap-2 sm:gap-2.5" aria-hidden="true">
        {Array.from({ length: 6 }).map((_, i) => {
          const ch = value[i];
          const active = focused && !locked && i === caret;
          return (
            <span
              key={i}
              className={cn(
                "flex h-14 items-center justify-center rounded-xl border text-2xl font-bold tabular-nums text-theme-primary transition-colors",
                invalid ? "border-destructive/60 bg-destructive/5" : active ? "border-emerald-500 ring-2 ring-emerald-500/20" : ch ? "border-emerald-500/50 bg-emerald-500/5" : "border-theme-border bg-theme-surface",
                locked && "opacity-60"
              )}
            >
              {ch ?? (active ? <span className="h-6 w-px animate-pulse bg-emerald-600" /> : null)}
            </span>
          );
        })}
      </div>
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange(extractCode(e.target.value))}
        onPaste={(e) => {
          // a pasted line such as "Your code is 675606" gives just the code
          e.preventDefault();
          onChange(extractCode(e.clipboardData.getData("text")));
        }}
        readOnly={locked}
        inputMode="numeric"
        autoComplete="one-time-code"
        aria-label="6-digit verification code"
        aria-invalid={invalid}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="absolute inset-0 h-full w-full cursor-text opacity-0"
      />
    </div>
  );
}

/**
 * The code step of a sign-up: the boxes, Paste and Clear, a Confirm button, and "Send again in 38s". The sixth digit starts the check by itself. The caller does the
 * checking and the sending; this only shows them. Start the countdown with the `ready` value being true each time a code has been sent (and again on every new one).
 */
export function CodeStep({
  code,
  onCode,
  onVerify,
  busy,
  invalid,
  onResend,
  resendGapSeconds,
  sentAt,
}: {
  code: string;
  onCode: (digits: string) => void;
  onVerify: (digits: string) => void;
  busy: boolean;
  invalid: boolean;
  onResend: () => void;
  /** how long before another code may be asked for (the server's own gap) */
  resendGapSeconds: number;
  /** changes every time a code was sent (a timestamp), which restarts the countdown */
  sentAt: number;
}) {
  const { left, start } = useCountdown();
  // each new code starts the countdown again (setState lives in start(), called from an effect keyed on the send)
  React.useEffect(() => {
    if (sentAt > 0) start(resendGapSeconds);
  }, [sentAt, resendGapSeconds, start]);

  function change(d: string) {
    onCode(d);
    if (d.length === 6) onVerify(d);
  }

  async function paste() {
    try {
      const text = await navigator.clipboard.readText();
      const d = extractCode(text);
      if (d.length === 0) return notify.error("There is no code in your clipboard. Copy the 6 digits from the e-mail first.");
      change(d);
    } catch {
      notify.error("Your browser did not allow pasting. Click a box and press Ctrl+V (or Cmd+V) instead.");
    }
  }

  return (
    <div className="space-y-4">
      <OtpBoxes value={code} onChange={change} locked={busy} invalid={invalid} />
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={() => void paste()} disabled={busy} className="h-8 gap-1.5 px-2.5 text-theme-secondary">
            <ClipboardPaste className="size-3.5" aria-hidden="true" /> Paste
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => onCode("")} disabled={busy || code.length === 0} className="h-8 gap-1.5 px-2.5 text-theme-secondary">
            <Eraser className="size-3.5" aria-hidden="true" /> Clear
          </Button>
        </div>
        <p className="text-sm text-theme-muted" aria-live="polite">
          {left > 0 ? (
            <span className="tabular-nums">Send again in {left}s</span>
          ) : (
            <button type="button" onClick={onResend} disabled={busy} className="font-medium text-theme-highlight underline-offset-4 hover:underline disabled:opacity-50">
              Send a new code
            </button>
          )}
        </p>
      </div>
      <Button type="button" className="w-full" disabled={busy || code.length !== 6} onClick={() => onVerify(code)}>
        {busy ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Checking…
          </span>
        ) : (
          "Confirm"
        )}
      </Button>
    </div>
  );
}
