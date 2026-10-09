// Keeps ONE live channel per device open for as long as the dashboard is open:
//   - opened when the first component needs it and the browser is online;
//   - kept open while the tab is in the background too (a connection the user left open is never cut because the window was
//     covered or minimised); it closes only when the page is closed, the browser goes offline, or the last user releases it
//     (the user left the page). No timer ever ends an open connection;
//   - retried with backoff, from a fresh channel each time, if the channel drops by itself - and a check every poll brings
//     back a channel that is missing for any reason;
//   - the connection state is re-read from the database every HEARTBEAT_POLL_MS whatever the live channel is doing, so a
//     missed message can never leave a healthy device looking offline.
// Everything environmental is injected, so the rules are tested without a browser.

import type { TelemetryStore } from "./store";
import type { TickPayload } from "./types";

export interface OpenChannelHandle {
  close(): void;
}

export interface LiveEnv {
  /** Open the channel for a device; call onStatus when it is joined or drops. */
  openChannel(
    deviceId: string,
    onTick: (t: TickPayload) => void,
    onStatus: (s: "joined" | "dropped") => void
  ): OpenChannelHandle | Promise<OpenChannelHandle>;
  isVisible(): boolean;
  isOnline(): boolean;
  /** Each returns an unsubscribe function. */
  onVisibility(cb: () => void): () => void;
  onPageHide(cb: () => void): () => void;
  onConnectivity(cb: () => void): () => void;
  setTimer(fn: () => void, ms: number): unknown;
  clearTimer(handle: unknown): void;
}

/** While a screen is open, the connection state is re-read from the database this often (the live channel can miss it). */
export const HEARTBEAT_POLL_MS = 30_000;
const BACKOFF_MS = [2_000, 4_000, 8_000, 16_000, 32_000, 60_000];

interface DeviceState {
  refs: number;
  handle: OpenChannelHandle | null;
  opening: boolean;
  everOpened: boolean;
  closedByUs: boolean;
  retryTimer: unknown;
  beatTimer: unknown;
  attempt: number;
}

export class DeviceLiveManager {
  private devices = new Map<string, DeviceState>();
  private offs: (() => void)[] = [];

  constructor(
    private readonly env: LiveEnv,
    private readonly store: TelemetryStore,
    private readonly onError: (e: unknown) => void = () => {}
  ) {
    this.offs.push(
      env.onVisibility(() => this.onVisibility()),
      env.onPageHide(() => this.closeAll("paused")),
      env.onConnectivity(() => this.onConnectivity())
    );
  }

  /** A component needs live updates for this device. Returns the release function. */
  acquire(deviceId: string): () => void {
    let s = this.devices.get(deviceId);
    if (!s) {
      s = { refs: 0, handle: null, opening: false, everOpened: false, closedByUs: false, retryTimer: null, beatTimer: null, attempt: 0 };
      this.devices.set(deviceId, s);
    }
    s.refs++;
    if (s.refs === 1) {
      void this.ensureOpen(deviceId);
      this.pollHeartbeat(deviceId);
    }
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const cur = this.devices.get(deviceId);
      if (!cur) return;
      cur.refs--;
      if (cur.refs <= 0) {
        this.close(deviceId, "idle");
        this.devices.delete(deviceId);
      }
    };
  }

  dispose(): void {
    this.offs.forEach((f) => f());
    this.closeAll("idle");
    this.devices.clear();
  }

  // ------------------------------------------------------------ internals

  /** Re-reads the agent's connection state while the screen is open (visible or not), so a missed live message never leaves a
   *  healthy device looking offline, and puts back a live channel that is missing for any reason. */
  private pollHeartbeat(deviceId: string): void {
    const s = this.devices.get(deviceId);
    if (!s || s.refs <= 0) return;
    if (this.env.isOnline()) {
      this.refreshState(deviceId);
      if (!s.handle && !s.opening && !s.retryTimer) void this.ensureOpen(deviceId);
    }
    s.beatTimer = this.env.setTimer(() => {
      s.beatTimer = null;
      this.pollHeartbeat(deviceId);
    }, HEARTBEAT_POLL_MS);
  }

  private refreshState(deviceId: string): void {
    this.store.refreshHeartbeat(deviceId).catch(this.onError);
  }

  private shouldBeOpen(): boolean {
    return this.env.isOnline();
  }

  private async ensureOpen(deviceId: string): Promise<void> {
    const s = this.devices.get(deviceId);
    if (!s || s.handle || s.opening || !this.shouldBeOpen()) return;
    s.opening = true;
    s.closedByUs = false;
    this.store.setStatus(deviceId, "connecting");
    const reopening = s.everOpened;
    try {
      const handle = await this.env.openChannel(
        deviceId,
        (t) => this.store.applyTick(deviceId, t),
        (st) => this.onChannelStatus(deviceId, st)
      );
      if (!this.devices.has(deviceId) || s.refs <= 0 || !this.shouldBeOpen()) {
        handle.close(); // released or offline while we were connecting
        s.opening = false;
        return;
      }
      s.handle = handle;
      s.everOpened = true;
    } catch (e) {
      s.opening = false;
      this.onError(e);
      this.scheduleRetry(deviceId);
      return;
    }
    s.opening = false;
    this.refreshState(deviceId);
    if (reopening) {
      // The channel was closed for a while: catch up on what was missed, in parallel.
      this.store.catchUp(deviceId).catch(this.onError);
    }
  }

  private onChannelStatus(deviceId: string, st: "joined" | "dropped"): void {
    const s = this.devices.get(deviceId);
    if (!s) return;
    if (st === "joined") {
      s.attempt = 0;
      if (this.store.getStatus(deviceId).status !== "live") this.store.setStatus(deviceId, "live");
      return;
    }
    if (s.closedByUs) return;
    // Let go of the dropped channel so the retry starts from a fresh one.
    const dropped = s.handle;
    s.handle = null;
    try {
      dropped?.close();
    } catch (e) {
      this.onError(e);
    }
    this.store.setStatus(deviceId, this.env.isOnline() ? "connecting" : "offline");
    this.scheduleRetry(deviceId);
  }

  private scheduleRetry(deviceId: string): void {
    const s = this.devices.get(deviceId);
    if (!s || s.retryTimer || s.refs <= 0) return;
    const delay = BACKOFF_MS[Math.min(s.attempt, BACKOFF_MS.length - 1)];
    s.attempt++;
    s.everOpened = true; // whatever happened in between, catch up once it is back
    s.retryTimer = this.env.setTimer(() => {
      s.retryTimer = null;
      void this.ensureOpen(deviceId);
    }, delay);
  }

  private close(deviceId: string, status: "paused" | "idle" | "offline"): void {
    const s = this.devices.get(deviceId);
    if (!s) return;
    if (s.retryTimer) {
      this.env.clearTimer(s.retryTimer);
      s.retryTimer = null;
    }
    s.closedByUs = true;
    if (status === "idle" && s.beatTimer) {
      this.env.clearTimer(s.beatTimer);
      s.beatTimer = null;
    }
    if (s.handle) {
      try {
        s.handle.close();
      } catch (e) {
        this.onError(e);
      }
      s.handle = null;
    }
    this.store.setStatus(deviceId, status);
  }

  private closeAll(status: "paused" | "idle"): void {
    for (const id of this.devices.keys()) this.close(id, status);
  }

  /** The tab is in front again: its timers may have been slowed while it was behind, so re-read the state and what was missed
   *  now, and bring back a channel that is not there. */
  private onVisibility(): void {
    if (!this.env.isVisible()) return;
    for (const [id, s] of this.devices) {
      this.refreshState(id);
      if (!s.handle && !s.opening) {
        s.attempt = 0;
        void this.ensureOpen(id);
      } else if (s.handle) {
        this.store.catchUp(id).catch(this.onError);
      }
    }
  }

  private onConnectivity(): void {
    for (const [id, s] of this.devices) {
      if (!this.env.isOnline()) this.close(id, "offline");
      else if (!s.handle && !s.opening) {
        s.attempt = 0;
        void this.ensureOpen(id);
      }
    }
  }
}
