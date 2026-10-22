"use client";

import * as React from "react";
import { cn } from "./cn";
import {
  FILE_ACCEPT,
  MAX_BODY,
  MAX_FILES,
  RATING_WORDS,
  STATUS_LABEL,
  STATUS_STEPS,
  acceptFiles,
  dayStarts,
  displayName,
  fileKind,
  formatBytes,
  isMine,
  lastMineId,
  roleName,
  seenBy,
  type AttachmentView,
  type MessageView,
  type TicketStatus,
  type TicketView,
  type Viewer,
} from "./support-model";

// The parts of a support screen that are the same in the customer app and the admin app: the status, the thread (names, "seen", files, the
// lines that say who took the ticket), the box to write in, the stars. The pages around them are each app's own.

const ICON = "size-4 shrink-0";
function Svg({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={cn(ICON, className)}>
      {children}
    </svg>
  );
}
export const PaperclipIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </Svg>
);
export const SendIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="m22 2-7 20-4-9-9-4Z" />
    <path d="M22 2 11 13" />
  </Svg>
);
const XIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M18 6 6 18M6 6l12 12" />
  </Svg>
);
const FileIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5Z" />
    <path d="M14 2v6h6" />
  </Svg>
);
const DownloadIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" />
  </Svg>
);
const LockIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </Svg>
);
function Ticks({ seen, className }: { seen: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={cn("size-3.5 shrink-0", className)}>
      <path d="m2 12.5 4.5 4.5L15 7.5" />
      {seen && <path d="m10 14 3 3L22 7.5" />}
    </svg>
  );
}

const STATUS_STYLE: Record<TicketStatus, string> = {
  open: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  in_progress: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  resolved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  closed: "bg-muted text-muted-foreground",
};

export function StatusPill({ status, className }: { status: string; className?: string }) {
  const s = (status in STATUS_LABEL ? status : "open") as TicketStatus;
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", STATUS_STYLE[s], className)}>{STATUS_LABEL[s]}</span>;
}

/** Received, Being handled, Resolved, Closed: how far the ticket has come. */
export function StatusSteps({ status }: { status: string }) {
  const at = Math.max(0, STATUS_STEPS.findIndex((s) => s.id === status));
  return (
    <ol className="flex items-center gap-1.5 text-[11px] text-muted-foreground" aria-label="Progress of the ticket">
      {STATUS_STEPS.map((s, i) => (
        <li key={s.id} className="flex items-center gap-1.5">
          <span className={cn("flex items-center gap-1", i <= at && "font-medium text-foreground")}>
            <span className={cn("size-1.5 rounded-full", i < at ? "bg-emerald-500" : i === at ? "bg-primary ring-2 ring-primary/25" : "bg-border")} />
            {s.label}
          </span>
          {i < STATUS_STEPS.length - 1 && <span className={cn("h-px w-4 sm:w-6", i < at ? "bg-emerald-500" : "bg-border")} />}
        </li>
      ))}
    </ol>
  );
}

/** Five stars: pick one (when `onChange` is given) or just show it. */
export function Stars({ value, onChange, size = "md" }: { value: number; onChange?: (v: number) => void; size?: "sm" | "md" | "lg" }) {
  const [hover, setHover] = React.useState(0);
  const shown = hover || value;
  const cls = size === "lg" ? "size-9" : size === "md" ? "size-6" : "size-4";
  return (
    <div className="inline-flex items-center gap-0.5" role={onChange ? "radiogroup" : "img"} aria-label={`${value} out of 5`} onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => {
        const star = (
          <svg viewBox="0 0 24 24" className={cn(cls, n <= shown ? "fill-amber-400 text-amber-400" : "fill-transparent text-muted-foreground/40")} stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" aria-hidden>
            <path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9Z" />
          </svg>
        );
        return onChange ? (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n === 1 ? "" : "s"}: ${RATING_WORDS[n]}`} onMouseEnter={() => setHover(n)} onFocus={() => setHover(n)} onBlur={() => setHover(0)} onClick={() => onChange(n)} className="rounded p-0.5 outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring">
            {star}
          </button>
        ) : (
          <span key={n}>{star}</span>
        );
      })}
    </div>
  );
}

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return "Today";
  if (same(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
}

function FileChip({ name, size, href }: { name: string; size?: number; href?: string }) {
  const body = (
    <>
      <FileIcon className="text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">{name}</span>
      {size !== undefined && <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(size)}</span>}
      {href && <DownloadIcon className="text-muted-foreground" />}
    </>
  );
  const cls = "flex w-60 max-w-full items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground";
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" className={cn(cls, "transition-colors hover:bg-muted")}>
      {body}
    </a>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function Files({ files, legacy, urls }: { files: readonly AttachmentView[]; legacy: string | null; urls: Record<string, string> }) {
  const all = [...files.map((f) => ({ key: f.id, path: f.path, name: f.file_name, size: f.size_bytes, mime: f.mime_type })), ...(legacy ? [{ key: legacy, path: legacy, name: displayName(legacy), size: undefined as number | undefined, mime: null as string | null }] : [])];
  if (all.length === 0) return null;
  return (
    <div className="mt-1.5 flex max-w-full flex-wrap gap-2">
      {all.map((f) =>
        fileKind(f.name, f.mime) === "image" && urls[f.path] ? (
          <a key={f.key} href={urls[f.path]} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-border bg-muted">
            {/* a signed link to a private picture: it cannot go through next/image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={urls[f.path]} alt={f.name} loading="lazy" className="max-h-52 max-w-[min(18rem,100%)] object-cover" />
          </a>
        ) : (
          <FileChip key={f.key} name={f.name} size={f.size} href={urls[f.path]} />
        ),
      )}
    </div>
  );
}

/** The messages of a ticket. `viewer` says whose side is on the right; `ownId` marks the person's own messages as "You". */
export function Thread({
  messages,
  attachments,
  urls,
  ticket,
  viewer,
  ownId,
}: {
  messages: readonly MessageView[];
  attachments: ReadonlyMap<string, AttachmentView[]>;
  urls: Record<string, string>;
  ticket: TicketView;
  viewer: Viewer;
  ownId: string;
}) {
  const starts = React.useMemo(() => dayStarts(messages), [messages]);
  const tickedId = lastMineId(messages, viewer);
  const forCustomer = viewer === "customer";

  return (
    <div className="flex flex-col gap-3">
      {messages.map((m) => {
        const day = starts.has(m.id) ? (
          <div key={`d-${m.id}`} className="my-1 flex justify-center">
            <span className="rounded-full bg-muted px-3 py-0.5 text-[11px] font-medium text-muted-foreground">{dayLabel(m.created_at)}</span>
          </div>
        ) : null;

        if (m.sender_role === "system") {
          return (
            <React.Fragment key={m.id}>
              {day}
              <div className="flex justify-center">
                <span className="max-w-full rounded-full bg-muted/70 px-3 py-1 text-center text-xs text-muted-foreground">
                  {m.body} · {timeOf(m.created_at)}
                </span>
              </div>
            </React.Fragment>
          );
        }

        const mine = isMine(m, viewer);
        const own = m.sender_id === ownId;
        const name = own ? "You" : (m.sender_name ?? (m.sender_role === "customer" ? "Customer" : roleName(m.sender_role, forCustomer)));
        const role = m.sender_role === "customer" ? null : roleName(m.sender_role, forCustomer);
        const seen = seenBy(m, ticket, viewer);

        return (
          <React.Fragment key={m.id}>
            {day}
            <div className={cn("flex w-full flex-col", mine ? "items-end" : "items-start")}>
              <div className="mb-1 flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
                <span className="font-medium text-foreground/80">{name}</span>
                {role && !own && <span>· {role}</span>}
                <span>· {timeOf(m.created_at)}</span>
              </div>
              <div
                className={cn(
                  "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-relaxed sm:max-w-[75%]",
                  m.internal
                    ? "rounded-br-md border border-dashed border-amber-500/60 bg-amber-500/10 text-foreground"
                    : mine
                      ? "rounded-br-md bg-primary text-primary-foreground"
                      : "rounded-bl-md border border-border bg-muted text-foreground",
                )}
              >
                {m.internal && (
                  <span className="mb-1 flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-300">
                    <LockIcon className="size-3" /> Internal note: only your team sees this
                  </span>
                )}
                {m.body}
              </div>
              <Files files={attachments.get(m.id) ?? []} legacy={m.attachment_path} urls={urls} />
              {m.id === tickedId && (
                <div className={cn("mt-1 flex items-center gap-1 px-1 text-[11px]", seen.seen ? "text-sky-600 dark:text-sky-400" : "text-muted-foreground")}>
                  <Ticks seen={seen.seen} />
                  {seen.seen ? (seen.by ? `Seen by ${seen.by}` : "Seen") : "Sent"}
                </div>
              )}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

export interface OutgoingMessage {
  body: string;
  files: File[];
  internal: boolean;
}

/** The box to write in: text, up to five files (pick them, or drop them here), and for staff a switch to make the message an internal note. */
export function Composer({
  onSend,
  disabled,
  disabledNote,
  placeholder = "Write a message…",
  allowInternal = false,
  autoFocus = false,
}: {
  onSend: (m: OutgoingMessage) => Promise<string[] | void>;
  disabled?: boolean;
  disabledNote?: React.ReactNode;
  placeholder?: string;
  allowInternal?: boolean;
  autoFocus?: boolean;
}) {
  const [text, setText] = React.useState("");
  const [files, setFiles] = React.useState<File[]>([]);
  const [internal, setInternal] = React.useState(false);
  const [problems, setProblems] = React.useState<string[]>([]);
  const [sending, setSending] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const area = React.useRef<HTMLTextAreaElement>(null);
  const picker = React.useRef<HTMLInputElement>(null);

  React.useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  const take = (list: FileList | File[] | null) => {
    if (!list) return;
    const { accepted, problems: p } = acceptFiles(files, [...list]);
    setFiles((cur) => [...cur, ...accepted]);
    setProblems(p);
  };

  const send = async () => {
    const body = text.trim() || (files.length > 0 ? `Shared ${files.length} file${files.length === 1 ? "" : "s"}` : "");
    if (!body || sending || disabled) return;
    setSending(true);
    setProblems([]);
    try {
      const failed = await onSend({ body, files, internal });
      setText("");
      setFiles([]);
      setInternal(false);
      if (picker.current) picker.current.value = "";
      if (failed && failed.length > 0) setProblems([`Your message was sent, but these files could not be uploaded: ${failed.join(", ")}.`]);
    } catch (e) {
      setProblems([e instanceof Error ? e.message : "The message could not be sent."]);
    } finally {
      setSending(false);
    }
  };

  if (disabled) return <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">{disabledNote}</div>;

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        take(e.dataTransfer.files);
      }}
      className={cn("rounded-2xl border bg-card p-2 transition-colors", dragging ? "border-primary bg-primary/5" : "border-border", internal && "border-dashed border-amber-500/60 bg-amber-500/5")}
    >
      {files.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2 px-1 pt-1">
          {files.map((f, i) => (
            <div key={`${f.name}-${i}`} className="flex max-w-full items-center gap-2 rounded-lg border border-border bg-background py-1 pl-2 pr-1 text-xs">
              <FileIcon className="text-muted-foreground" />
              <span className="max-w-40 truncate">{f.name}</span>
              <span className="text-muted-foreground">{formatBytes(f.size)}</span>
              <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                <XIcon className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-end gap-1.5">
        <input ref={picker} type="file" multiple accept={FILE_ACCEPT} className="hidden" onChange={(e) => take(e.target.files)} />
        <button type="button" onClick={() => picker.current?.click()} disabled={sending || files.length >= MAX_FILES} aria-label="Attach files" title={`Attach up to ${MAX_FILES} files`} className="mb-0.5 flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40">
          <PaperclipIcon className="size-5" />
        </button>
        <textarea
          ref={area}
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_BODY))}
          rows={1}
          autoFocus={autoFocus}
          disabled={sending}
          placeholder={internal ? "Write an internal note for your team…" : placeholder}
          aria-label="Message"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void send();
            }
          }}
          className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground"
        />
        <button type="button" onClick={() => void send()} disabled={sending || (!text.trim() && files.length === 0)} aria-label="Send" className="mb-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-40">
          {sending ? <span className="size-4 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" /> : <SendIcon className="size-4" />}
        </button>
      </div>
      {(allowInternal || problems.length > 0) && (
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2 px-2 pb-1 text-xs">
          {allowInternal ? (
            <label className="flex cursor-pointer items-center gap-1.5 text-muted-foreground">
              <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} className="size-3.5 accent-amber-500" />
              <LockIcon className="size-3" /> Internal note (the customer does not see it)
            </label>
          ) : (
            <span />
          )}
        </div>
      )}
      {problems.length > 0 && (
        <ul className="mt-1 space-y-0.5 px-2 pb-1 text-xs text-destructive" role="alert">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Stars and a comment, to close or rate a ticket. */
export function RatingForm({ onSubmit, onSkip, submitLabel = "Submit", skipLabel }: { onSubmit: (rating: number, comment: string) => Promise<void>; onSkip?: () => Promise<void>; submitLabel?: string; skipLabel?: string }) {
  const [rating, setRating] = React.useState(0);
  const [comment, setComment] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-col items-center gap-1">
        <Stars value={rating} onChange={setRating} size="lg" />
        <p className="h-4 text-xs text-muted-foreground">{rating > 0 ? RATING_WORDS[rating] : "Tap a star"}</p>
      </div>
      <textarea value={comment} onChange={(e) => setComment(e.target.value.slice(0, 1000))} rows={2} placeholder="Anything you would like to add? (optional)" aria-label="Comment" className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {onSkip && skipLabel && (
          <button type="button" disabled={busy} onClick={() => void run(onSkip)} className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50">
            {skipLabel}
          </button>
        )}
        <button type="button" disabled={busy || rating === 0} onClick={() => void run(() => onSubmit(rating, comment))} className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-50">
          {busy ? "Saving…" : submitLabel}
        </button>
      </div>
    </div>
  );
}
