"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CarFront } from "lucide-react";
import { notify } from "@waytara/ui/notify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEFAULT_KM_PER_KWH, parseCarInput, type CarProfile } from "@/lib/ev-car";
import { saveCar } from "@/app/dashboard/settings/actions";
import { FieldRow, SettingsCard, TwoColumns } from "./settings-card";

/** Settings > Dashboard > Your car: the battery size and how far the car goes on a kWh. With them a charge on the Overview shows how much of the
 *  battery it has added, how far that drives and how long a booked amount still needs. Nothing here is read from the car. */
export function CarSection({ initial }: { initial: CarProfile | null }) {
  const router = useRouter();
  const [battery, setBattery] = React.useState(initial ? String(initial.batteryKwh) : "");
  const [efficiency, setEfficiency] = React.useState(String(initial?.kmPerKwh ?? DEFAULT_KM_PER_KWH));
  const [saved, setSaved] = React.useState<CarProfile | null>(initial);
  const [busy, setBusy] = React.useState(false);
  const [problem, setProblem] = React.useState<string | null>(null);

  const typed = parseCarInput(battery, efficiency);
  const changed = !typed.ok || saved === null || typed.car.batteryKwh !== saved.batteryKwh || typed.car.kmPerKwh !== saved.kmPerKwh;

  async function save(car: CarProfile | null) {
    setBusy(true);
    setProblem(null);
    try {
      await saveCar(car);
      setSaved(car);
      if (!car) {
        setBattery("");
        setEfficiency(String(DEFAULT_KM_PER_KWH));
      }
      notify.success(car ? "Your car is saved." : "Your car is removed.", { duration: 1500 });
      router.refresh();
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Could not save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!typed.ok) {
      setProblem(typed.message);
      return;
    }
    void save(typed.car);
  }

  return (
    <form onSubmit={submit}>
      <SettingsCard
        title="Your car"
        description="With your car's battery size and how far it goes on a kWh, a charge on the Overview shows how much of the battery it has added, how far that drives and how long a booked amount still needs."
        icon={CarFront}
        tone="emerald"
        footer={
          <>
            {saved && (
              <Button type="button" variant="ghost" onClick={() => void save(null)} disabled={busy}>
                Remove
              </Button>
            )}
            <Button type="submit" disabled={busy || !changed}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </>
        }
      >
        <TwoColumns
          left={
            <FieldRow label="Battery size (kWh)" htmlFor="car-battery" hint="The usable size, as in the car's manual (for example 24 or 39.2).">
              <Input id="car-battery" inputMode="decimal" value={battery} onChange={(e) => setBattery(e.target.value)} placeholder="e.g. 39.2" autoComplete="off" />
            </FieldRow>
          }
          right={
            <FieldRow label="Range per kWh (km)" htmlFor="car-efficiency" hint="How far it goes on 1 kWh: about 6 for most small cars. The car's trip screen shows it.">
              <Input id="car-efficiency" inputMode="decimal" value={efficiency} onChange={(e) => setEfficiency(e.target.value)} placeholder="6" autoComplete="off" />
            </FieldRow>
          }
        />
        {problem && (
          <p role="alert" className="text-sm text-destructive">
            {problem}
          </p>
        )}
      </SettingsCard>
    </form>
  );
}
