// Keeps ONE live channel per device open only while it is useful:
//   - opened when the first component needs it and the tab is visible and online;
//   - closed 10 s after the tab is hidden (so a tab left in the background stops costing messages),
//     immediately when the page is closed or the browser goes offline, and when the last user releases it;
//   - reopened when the tab is visible again, followed by one parallel catch-up of what was missed;
//   - retried with backoff if the channel drops by itself.
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

export const HIDDEN_GRACE_MS = 10_000;
const BACKOFF_MS = [2_000, 4_000, 8_000, 16_000, 32_000, 60_000];

interface DeviceState {
  refs: number;
  handle: OpenChannelHandle | null;
  opening: boolean;
  everOpened: boolean;
  closedByUs: boolean;
  hideTimer: unknown;
  retryTimer: unknown;
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
      s = { refs: 0, handle: null, opening: false, everOpened: false, closedByUs: false, hideTimer: null, retryTimer: null, attempt: 0 };
      this.devices.set(deviceId, s);
    }
    s.refs++;
    if (s.refs === 1) void this.ensureOpen(deviceId);
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

  private shouldBeOpen(): boolean {
    return this.env.isVisible() && this.env.isOnline();
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
        handle.close(); // released or hidden while we were connecting
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
    s.handle = null;
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
    if (s.hideTimer) {
      this.env.clearTimer(s.hideTimer);
      s.hideTimer = null;
    }
    if (s.retryTimer) {
      this.env.clearTimer(s.retryTimer);
      s.retryTimer = null;
    }
    s.closedByUs = true;
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

  private onVisibility(): void {
    for (const [id, s] of this.devices) {
      if (this.env.isVisible()) {
        if (s.hideTimer) {
          this.env.clearTimer(s.hideTimer);
          s.hideTimer = null;
        }
        if (!s.handle && !s.opening) {
          s.attempt = 0;
          void this.ensureOpen(id);
        }
      } else if (!s.hideTimer && s.handle) {
        s.hideTimer = this.env.setTimer(() => {
          s.hideTimer = null;
          this.close(id, "paused");
        }, HIDDEN_GRACE_MS);
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
