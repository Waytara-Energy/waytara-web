"use client";

import * as React from "react";
import { OVERVIEW_LIVE_KEYS } from "@/lib/overview-keys";
import { computeDeviceState, type ConnectionStatus, type DeviceState } from "@/lib/device-state";
import type { DeviceSyncInit } from "@/lib/device-sync-types";
import { useTelemetryStore } from "@/lib/telemetry/react";
import { GoLiveProvider, useGoLive } from "./go-live";
import { LiveChannelKeeper, OverviewLiveBridge } from "./overview-live-bridge";

/** An inverter or an EV charger of the selected site: what the device controls (in the sidebar) and the brand button's badge are built from. */
export interface StatusDevice {
  id: string;
  name: string;
  kind: "inverter" | "ev";
  sync: DeviceSyncInit;
}

/** The inverter's PV power keys, so a live connection also brings the solar inputs. */
const PV_KEYS = ["pv1_power_w", "pv2_power_w", "pv3_power_w", "pv4_power_w"];
const EV_LIVE_KEYS = ["power_active_import_kw", "power_offered_kw", "current_import_l1_a", "voltage_l1_n_v", "connector_temperature_c"];

/** A device's Go Live, as the sidebar sees it: its state ("off", "connecting", "live", "error" ...) and how to start and stop it. */
export interface DeviceLiveControl {
  status: string;
  start: () => void;
  stop: () => void;
}

export interface DeviceProblem {
  id: string;
  kind: "inverter" | "ev";
  status: Exclude<ConnectionStatus, "online">;
}

interface HubValue {
  controls: Record<string, DeviceLiveControl>;
  states: Record<string, DeviceState>;
  /** The devices that are not reporting right now. */
  problems: DeviceProblem[];
  /** Now (epoch ms), moved on every 15 seconds, for "5 mins ago". */
  clock: number;
}

const NONE: HubValue = { controls: {}, states: {}, problems: [], clock: 0 };
const HubContext = React.createContext<HubValue>(NONE);

/** What the sidebar and the brand button know about the site's devices. Outside the dashboard it is empty. */
export function useDeviceHub(): HubValue {
  return React.useContext(HubContext);
}

/** The connection state of each device, live: from the server's first reading, then the server's verdict as it changes over the live channel (the browser
 *  does not judge silence). */
function useDeviceStates(devices: StatusDevice[]) {
  const store = useTelemetryStore();
  const [clock, setClock] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setClock(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);
  // Changes whenever any device's live status changes (the live status objects are replaced, so a text key is the stable signal).
  const sig = React.useSyncExternalStore(
    store.subscribe,
    () =>
      devices
        .map((d) => {
          const s = store.getStatus(d.id);
          return `${s.lastTickAt}|${s.lastReadAt}|${s.deviceOnline}|${s.verdict?.status}|${s.verdict?.serverNowMs}`;
        })
        .join(";"),
    () => ""
  );
  const states = React.useMemo(
    () => Object.fromEntries(devices.map((d) => [d.id, computeDeviceState(d.sync, store.getStatus(d.id), clock)])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [devices, store, clock, sig]
  );
  return { states, clock, store };
}

/**
 * Holds, on every dashboard page, what the devices' controls need to outlive the sidebar (which is closed most of the time, and on a phone is not even in the
 * page then):
 *  - every device's live channel and the 30-second connection check (without them a page with no live number on it would never hear that a device is still
 *    checking in, and would show it offline),
 *  - one Go Live session per device, with the bridge that feeds its readings into the page, so a device that was set live from the sidebar stays live while
 *    the sidebar is closed and the energy flow, the cards and the charts follow it,
 *  - each device's connection state, and the list of the ones that are not reporting (the brand button's badge).
 * The device controls themselves (last reading, status, refresh, Go Live) are in the sidebar, which reads all this through useDeviceHub.
 */
export function DeviceLiveHub({ devices, children }: { devices: StatusDevice[]; children: React.ReactNode }) {
  const { states, clock, store } = useDeviceStates(devices);
  const [statuses, setStatuses] = React.useState<Record<string, string>>({});
  const [fns] = React.useState(() => new Map<string, { start: () => void; stop: () => void }>());
  const report = React.useCallback((id: string, status: string) => setStatuses((prev) => (prev[id] === status ? prev : { ...prev, [id]: status })), []);

  const controls = React.useMemo(
    () =>
      Object.fromEntries(
        devices.map((d) => [
          d.id,
          {
            status: statuses[d.id] ?? "off",
            // going live also re-reads the device's connection from the server, so the time under its name is current straight away
            start: () => {
              fns.get(d.id)?.start();
              void store.refreshHeartbeat(d.id);
            },
            stop: () => fns.get(d.id)?.stop(),
          },
        ])
      ) as Record<string, DeviceLiveControl>,
    [devices, statuses, store, fns]
  );
  const problemKey = devices.map((d) => `${d.id}:${states[d.id]?.status ?? "online"}`).join(",");
  const problems = React.useMemo(
    () =>
      devices.flatMap((d): DeviceProblem[] => {
        const status = states[d.id]?.status ?? "online";
        return status === "online" ? [] : [{ id: d.id, kind: d.kind, status }];
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [problemKey]
  );
  const value = React.useMemo(() => ({ controls, states, problems, clock }), [controls, states, problems, clock]);

  return (
    <HubContext.Provider value={value}>
      <LiveChannelKeeper deviceIds={devices.map((d) => d.id)} />
      {devices.map((d) => (
        <Session key={d.id} device={d} report={report} fns={fns} />
      ))}
      {children}
    </HubContext.Provider>
  );
}

/** One device's Go Live session and the bridge that feeds its readings into the page. */
function Session({ device, report, fns }: { device: StatusDevice; report: (id: string, status: string) => void; fns: Map<string, { start: () => void; stop: () => void }> }) {
  const keys = React.useMemo(() => (device.kind === "inverter" ? [...OVERVIEW_LIVE_KEYS, ...PV_KEYS] : EV_LIVE_KEYS), [device.kind]);
  return (
    <GoLiveProvider deviceId={device.id} agentOnline history={false}>
      <Capture id={device.id} report={report} fns={fns} />
      <OverviewLiveBridge deviceId={device.id} keys={keys} />
    </GoLiveProvider>
  );
}

/** Hands the session's state and its start and stop up to the hub. */
function Capture({ id, report, fns }: { id: string; report: (id: string, status: string) => void; fns: Map<string, { start: () => void; stop: () => void }> }) {
  const live = useGoLive();
  const ref = React.useRef(live);
  React.useEffect(() => {
    ref.current = live;
  });
  React.useEffect(() => {
    fns.set(id, { start: () => ref.current?.start(), stop: () => ref.current?.stop() });
    return () => void fns.delete(id);
  }, [id, fns]);
  const status = live?.state.status ?? "off";
  React.useEffect(() => report(id, status), [id, status, report]);
  return null;
}
