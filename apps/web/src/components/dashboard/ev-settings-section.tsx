import type { LastSyncInfo } from "@/lib/device-sync";
import type { EvConnectionInfo } from "@/lib/ev-settings-data";
import { wsAddress } from "@/lib/ev-settings";
import { DeviceCard } from "./device-card";
import { EvSettingsConfig } from "./ev-settings-config";
import { EvSettingsControls } from "./ev-settings-controls";
import { EvSettingsLog } from "./ev-settings-log";

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 text-sm first:pt-0 last:pb-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-all text-right font-medium">{children}</dd>
    </div>
  );
}

const ago = (minutes: number | null): string => (minutes === null ? "Not yet" : minutes < 1 ? "Just now" : minutes < 60 ? `${minutes} min ago` : minutes < 1440 ? `${Math.floor(minutes / 60)} h ago` : `${Math.floor(minutes / 1440)} days ago`);

/** The "OCPP and charger" part of an EV charger's Devices page: how it is connected, the controls (unlock, restart), the charger's own settings and,
 *  for WayTara staff, the message log. Settings and log go through the service with the person's own pass: the service decides who may. */
export function EvSettingsSection({ chargerId, info, sync, isStaff }: { chargerId: string; info: EvConnectionInfo; sync: LastSyncInfo; isStaff: boolean }) {
  const identity = [info.vendor, info.model].filter(Boolean).join(" ");
  return (
    <section className="space-y-4" aria-labelledby="ev-ocpp-heading">
      <div>
        <h2 id="ev-ocpp-heading" className="text-base font-semibold">
          OCPP and charger
        </h2>
        <p className="text-sm text-muted-foreground">How this charger talks to WayTara, what you can ask it to do, and its own settings.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <DeviceCard title="Connection">
          <dl className="divide-y divide-theme-border">
            <Line label="Charger name in the address">{info.chargePointId ?? "Not added to a monitoring unit"}</Line>
            <Line label="Connected through">{info.unitLabel ?? "—"}</Line>
            {info.chargePointId ? (
              <Line label="Address the unit serves">
                <span className="font-mono text-xs">{wsAddress(info.chargePointId)}</span>
              </Line>
            ) : null}
            <Line label="Last check-in">{ago(sync.minutesAgo)}</Line>
            <Line label="Charger">{identity || "Not reported yet"}</Line>
            <Line label="Serial number">{info.serial ?? "—"}</Line>
            <Line label="Firmware">{info.firmware ?? "—"}</Line>
          </dl>
          {info.chargePointId ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Set the charger&apos;s server address to the one above while it is on the monitoring unit&apos;s own Wi-Fi network (its name and password are on the setup page, EV chargers). The address
              needs no internet.
            </p>
          ) : null}
        </DeviceCard>

        <DeviceCard title="Charger controls" description="Each one asks the charger. It must be connected.">
          <EvSettingsControls chargerId={chargerId} />
        </DeviceCard>

        <DeviceCard className="lg:col-span-2" title="Charger settings" description="The charger's own OCPP configuration, read from the charger when you ask.">
          <EvSettingsConfig chargerId={chargerId} canEdit={isStaff} />
        </DeviceCard>

        {isStaff ? (
          <DeviceCard className="lg:col-span-2" title="Message log" description="What the charger and WayTara said to each other (staff only).">
            <EvSettingsLog chargerId={chargerId} />
          </DeviceCard>
        ) : null}
      </div>
    </section>
  );
}
