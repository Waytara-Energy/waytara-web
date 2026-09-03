"use client";

import * as React from "react";
import { createClient } from "@waytara/supabase/client";

// Derived from the browser client's own return type rather than importing
// @supabase/supabase-js directly — packages/ui only depends on
// @waytara/supabase (see package.json), and pnpm's strict resolution means
// a transitive package isn't reliably importable from here. Self-contained
// on purpose, same reasoning as monitoring-panel.tsx defining its own
// `ReadingRow` shape instead of reaching for a generated DB type.
type SupabaseBrowserClient = ReturnType<typeof createClient>;
type RealtimeChannel = ReturnType<SupabaseBrowserClient["channel"]>;

export type PgChangeEvent = "INSERT" | "UPDATE" | "DELETE";

/** Our own shape for a postgres_changes payload — DELETE is deliberately
 *  not part of PgChangeEvent app-wide (see realtime-provider's own
 *  reasoning below), so `old` only ever shows up as the *previous* values
 *  on an UPDATE, where it's whatever the table's replica identity ships
 *  (primary key only, for every table in this project today — don't rely
 *  on any column beyond the PK being present in `old`). */
export interface RealtimeRowEvent<T = Record<string, unknown>> {
  eventType: PgChangeEvent;
  new: T;
  old: Partial<T>;
  table: string;
  schema: string;
  commitTimestamp: string;
}

type EventHandler = (payload: RealtimeRowEvent) => void;

interface ChannelEntry {
  channel: RealtimeChannel;
  handlers: Set<EventHandler>;
  pending: RealtimeRowEvent[];
  debounceTimer: ReturnType<typeof setTimeout> | null;
}

interface RealtimeContextValue {
  subscribe: (table: string, event: PgChangeEvent, filter: string | undefined, handler: EventHandler) => () => void;
}

const RealtimeContext = React.createContext<RealtimeContextValue | null>(null);

// One real device tick is ~20-30 individual device_readings INSERTs (one
// per instrument key) arriving within milliseconds of each other — without
// coalescing, that's 20-30 UI updates for one logical "new reading" tick.
// 300ms is short enough that nothing feels delayed, long enough to catch a
// whole burst on one debounce window.
const DEBOUNCE_MS = 300;

function channelKey(table: string, event: PgChangeEvent, filter: string | undefined): string {
  return `${table}:${event}:${filter ?? ""}`;
}

/**
 * Owns exactly one browser Supabase client and one realtime websocket
 * connection for the whole tree beneath it — every `useRealtimeTable` call
 * anywhere in that tree shares this single connection rather than each
 * component opening its own, and two calls asking for the *same*
 * table+event+filter (e.g. Monitoring's two LiveMetricChart instances,
 * both scoped to the same device) share one actual channel subscription,
 * reference-counted, instead of two redundant ones.
 *
 * Mount once per app, scoped to the authenticated dashboard tree only (see
 * dashboard/layout.tsx in both apps) — there's no per-user live data on a
 * public marketing page to subscribe to, so this deliberately isn't in
 * either app's root layout.
 *
 * DELETE and TRUNCATE are not supported here on purpose: Postgres logical
 * replication only ships the columns covered by a table's replica identity
 * for a DELETE's old-row data, and every table in this project uses the
 * default identity (primary key only) — so Realtime can't evaluate an RLS
 * policy that filters on anything but the PK (e.g. `customer_id =
 * auth.uid()`) for a DELETE event, meaning it can't safely decide who
 * should receive it. Nothing in either app currently needs to react to a
 * row actually disappearing (alerts get acknowledged via UPDATE, tickets
 * get closed via UPDATE, nothing user-facing gets hard-deleted in normal
 * use) — INSERT/UPDATE cover every real case, so this sidesteps the
 * problem instead of working around it.
 */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const supabaseRef = React.useRef<SupabaseBrowserClient | null>(null);
  if (!supabaseRef.current) supabaseRef.current = createClient();
  const supabase = supabaseRef.current;

  const channelsRef = React.useRef<Map<string, ChannelEntry>>(new Map());

  const subscribe = React.useCallback(
    (table: string, event: PgChangeEvent, filter: string | undefined, handler: EventHandler) => {
      const key = channelKey(table, event, filter);
      let entry = channelsRef.current.get(key);

      if (!entry) {
        const newEntry: ChannelEntry = { channel: null as unknown as RealtimeChannel, handlers: new Set(), pending: [], debounceTimer: null };

        const flush = () => {
          const batch = newEntry.pending;
          newEntry.pending = [];
          newEntry.debounceTimer = null;
          for (const h of newEntry.handlers) {
            for (const payload of batch) h(payload);
          }
        };

        // `postgres_changes` isn't schema-inferred from the query builder's
        // db.schema config — every call has to name `waytara` explicitly.
        // The SDK's overloads for this call are awkward to satisfy
        // generically across a dynamic `event`/`table`, hence the casts —
        // scoped tightly to this one call, not leaked to callers, who only
        // ever see our own RealtimeRowEvent shape.
        const channel = supabase.channel(`rt:${key}`).on(
          "postgres_changes" as never,
          { event, schema: "waytara", table, filter } as never,
          (payload: {
            eventType: PgChangeEvent;
            new: Record<string, unknown>;
            old: Record<string, unknown>;
            table: string;
            schema: string;
            commit_timestamp: string;
          }) => {
            newEntry.pending.push({
              eventType: payload.eventType,
              new: payload.new,
              old: payload.old,
              table: payload.table,
              schema: payload.schema,
              commitTimestamp: payload.commit_timestamp,
            });
            if (newEntry.debounceTimer) clearTimeout(newEntry.debounceTimer);
            newEntry.debounceTimer = setTimeout(flush, DEBOUNCE_MS);
          }
        );
        channel.subscribe();
        newEntry.channel = channel;

        entry = newEntry;
        channelsRef.current.set(key, entry);
      }

      entry.handlers.add(handler);

      return () => {
        const e = channelsRef.current.get(key);
        if (!e) return;
        e.handlers.delete(handler);
        if (e.handlers.size === 0) {
          if (e.debounceTimer) clearTimeout(e.debounceTimer);
          supabase.removeChannel(e.channel);
          channelsRef.current.delete(key);
        }
      };
    },
    [supabase]
  );

  // Keep the realtime connection authorized across the session-refresh work
  // from earlier — a channel opened with one access token silently stops
  // receiving authorized events once that token expires unless the
  // realtime client is told about the refreshed one. Also tear every
  // channel down immediately on sign-out, just ahead of SessionWatcher's
  // redirect (see @waytara/ui/use-session-signed-out) — a channel that
  // outlives the session is a leak, not a feature.
  React.useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "TOKEN_REFRESHED" && session?.access_token) {
        supabase.realtime.setAuth(session.access_token);
      }
      if (event === "SIGNED_OUT") {
        for (const [, entry] of channelsRef.current) {
          if (entry.debounceTimer) clearTimeout(entry.debounceTimer);
          supabase.removeChannel(entry.channel);
        }
        channelsRef.current.clear();
      }
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  const value = React.useMemo(() => ({ subscribe }), [subscribe]);

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

/**
 * Subscribes to one table's INSERT or UPDATE events, optionally filtered
 * (Postgrest filter syntax, e.g. `` `device_id=eq.${deviceId}` ``) — always
 * filter when the data is customer/device/ticket-scoped, the same way the
 * equivalent query already would; an unfiltered table-wide channel isn't
 * what any page here actually needs. `onEvent` fires once per event inside
 * a table+event+filter's shared debounce window (see RealtimeProvider) —
 * for a burst of N rows changing together, expect N calls within one
 * ~300ms window, not one call per row spread across N renders.
 *
 * Must be called under a `<RealtimeProvider>` — throws otherwise, the same
 * "you forgot to mount the provider" failure mode as any other required
 * context.
 */
export function useRealtimeTable<T = Record<string, unknown>>(
  table: string,
  event: PgChangeEvent,
  filter: string | undefined,
  onEvent: (payload: RealtimeRowEvent<T>) => void
) {
  const ctx = React.useContext(RealtimeContext);
  if (!ctx) {
    throw new Error("useRealtimeTable must be used within a <RealtimeProvider>");
  }

  const handlerRef = React.useRef(onEvent);
  handlerRef.current = onEvent;

  React.useEffect(() => {
    // A stable wrapper so the shared channel's handler-set identity doesn't
    // churn just because the caller passed a new inline function this
    // render — only mount/unmount (or a real change to table/event/filter)
    // should add/remove a subscriber.
    const stableHandler: EventHandler = (payload) => handlerRef.current(payload as RealtimeRowEvent<T>);
    return ctx.subscribe(table, event, filter, stableHandler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, table, event, filter]);
}
