"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, RotateCcw, Ruler, SlidersHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUnits } from "@/components/units-provider";
import { MAX_OVERRIDES, PREF_QUANTITIES, QUANTITY_LABEL, UNIT_CHOICES, displayValue, formatShown, hasUnitChoices, type PrefQuantity, type UnitPrefs } from "@/lib/unit-prefs";
import { saveUnits } from "@/app/dashboard/settings/actions";
import { cn } from "@/lib/utils";
import { SettingsCard, TwoColumns } from "./settings-card";
import { useAutoSave } from "./use-auto-save";

/** A reading a person can pick for the "particular values" list (see lib/unit-fields.ts). */
export interface PickableValue {
  key: string;
  label: string;
  unit: string;
  quantity: PrefQuantity;
  where: string;
}

/** What each kind looks like in a unit, so a choice can be seen before it is saved: a typical reading in the device's own unit and in the new one. */
const EXAMPLE: Record<PrefQuantity, { value: number; unit: string }> = {
  power: { value: 6.5, unit: "kW" },
  energy: { value: 12.4, unit: "kWh" },
  temperature: { value: 36.5, unit: "°C" },
  voltage: { value: 230, unit: "V" },
  current: { value: 12.5, unit: "A" },
};

const AS_REPORTED = "default";

function Example({ quantity, chosen }: { quantity: PrefQuantity; chosen: string | undefined }) {
  const ex = EXAMPLE[quantity];
  const prefs: UnitPrefs = { defaults: chosen ? { [quantity]: chosen } : {}, overrides: {} };
  const shown = displayValue(ex.value, ex.unit, prefs);
  return (
    <span className="text-xs text-muted-foreground">
      {ex.value} {ex.unit}
      {shown.converted && <> shows as <span className="font-medium text-foreground">{formatShown(shown, 1)}</span></>}
    </span>
  );
}

/** Settings > Units: the unit numbers are shown in, for a whole kind (power, energy, temperature, voltage, current) or for one reading. It changes
 *  how readings are shown on every page of the dashboard; nothing stored or measured changes, and downloaded reports keep their own units. */
export function UnitsSection({ initial, values }: { initial: UnitPrefs; values: PickableValue[] }) {
  const router = useRouter();
  const { setPrefs } = useUnits();
  // every choice saves itself (no Save button); every open page follows at once
  const { value: prefs, update: setLocal } = useAutoSave<UnitPrefs>(initial, saveUnits, {
    message: "Units saved.",
    onSaved: (saved) => {
      setPrefs(saved);
      router.refresh();
    },
  });
  const [pickKey, setPickKey] = React.useState<string>("");

  const byKey = React.useMemo(() => new Map(values.map((v) => [v.key, v])), [values]);
  const overrideKeys = Object.keys(prefs.overrides);
  const available = values.filter((v) => !(v.key in prefs.overrides));

  const setDefault = (q: PrefQuantity, unit: string) =>
    setLocal((p) => {
      const defaults = { ...p.defaults };
      if (unit === AS_REPORTED) delete defaults[q];
      else defaults[q] = unit;
      return { ...p, defaults };
    });
  const setOverride = (key: string, unit: string) => setLocal((p) => ({ ...p, overrides: { ...p.overrides, [key]: unit } }));
  const removeOverride = (key: string) =>
    setLocal((p) => {
      const overrides = { ...p.overrides };
      delete overrides[key];
      return { ...p, overrides };
    });

  function addOverride() {
    const v = byKey.get(pickKey);
    if (!v) return;
    // starts as another unit of its kind than the device's own, so the choice is visible straight away
    const own = UNIT_CHOICES[v.quantity].find((u) => u.label === v.unit || u.id === v.unit.replace("°", ""))?.id;
    const first = UNIT_CHOICES[v.quantity].find((u) => u.id !== own)?.id ?? UNIT_CHOICES[v.quantity][0].id;
    setOverride(v.key, first);
    setPickKey("");
  }

  return (
    <TwoColumns
      left={
      <SettingsCard icon={Ruler} tone="sky" title="Units" description="Choose the unit numbers are shown in, everywhere in the dashboard: Overview, Monitoring, Performance, Reports and the charts. Nothing is recalculated or stored differently; only how it is shown changes.">
        {hasUnitChoices(prefs) && (
          <div className="-mt-1 flex justify-end">
            <Button type="button" variant="outline" size="sm" onClick={() => setLocal({ defaults: {}, overrides: {} })}>
              <RotateCcw className="size-3.5" />
              Back to as reported
            </Button>
          </div>
        )}
        <div className="divide-y divide-border">
          {PREF_QUANTITIES.map((q) => {
            const chosen = prefs.defaults[q];
            return (
              <div key={q} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3.5 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{QUANTITY_LABEL[q]}</p>
                  <Example quantity={q} chosen={chosen} />
                </div>
                <div role="radiogroup" aria-label={`${QUANTITY_LABEL[q]} unit`} className="flex flex-wrap gap-1.5">
                  {[{ id: AS_REPORTED, label: "As reported" }, ...UNIT_CHOICES[q]].map((o) => {
                    const on = (chosen ?? AS_REPORTED) === o.id;
                    return (
                      <button
                        key={o.id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setDefault(q, o.id)}
                        className={cn("rounded-lg border px-3 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring", on ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:bg-accent hover:text-foreground")}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </SettingsCard>
      }
      right={
      <SettingsCard icon={SlidersHorizontal} tone="violet" title="Particular values" description="Show one reading in a different unit from the rest. A choice here beats the choice for its kind above (for example, show the grid power in W while power is otherwise in kW).">
        {overrideKeys.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">No particular values yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {overrideKeys.map((key) => {
              const v = byKey.get(key);
              const q = v?.quantity ?? PREF_QUANTITIES.find((p) => UNIT_CHOICES[p].some((u) => u.id === prefs.overrides[key]));
              return (
                <li key={key} className="flex flex-wrap items-center gap-3 px-3.5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{v?.label ?? key}</p>
                    <p className="truncate text-xs text-muted-foreground">{v ? `${v.where} · reported in ${v.unit}` : "Not on this site"}</p>
                  </div>
                  {q && (
                    <Select value={prefs.overrides[key]} onValueChange={(u) => setOverride(key, u)}>
                      <SelectTrigger aria-label={`Unit for ${v?.label ?? key}`} className="h-9 w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {UNIT_CHOICES[q].map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Button type="button" variant="outline" size="icon" className="size-9" aria-label={`Remove the choice for ${v?.label ?? key}`} onClick={() => removeOverride(key)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        {overrideKeys.length < MAX_OVERRIDES &&
          (available.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <Select value={pickKey} onValueChange={setPickKey}>
                <SelectTrigger aria-label="Choose a value" className="h-9 w-full sm:w-80">
                  <SelectValue placeholder="Choose a value…" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {available.map((v) => (
                    <SelectItem key={v.key} value={v.key}>
                      {v.label} · {v.unit}
                      {v.where ? ` · ${v.where}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" size="sm" disabled={!pickKey} onClick={addOverride}>
                <Plus className="size-3.5" />
                Add
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{values.length === 0 ? "The values of your devices appear here once a device is set up." : "Every value that can be converted already has a choice."}</p>
          ))}
      </SettingsCard>

      }
    />
  );
}
