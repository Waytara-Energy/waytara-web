import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@waytara/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

// Per-device audit view over device_settings — old value -> new value,
// who, when, and whether it came from a preset. device_settings already
// carries all of that in clean typed columns (previous_value,
// setting_value, applied_preset_key, written_by, ts), so this reads it
// directly rather than going through audit_log's generic before/after
// JSON blob (the /audit page already covers that cross-entity case).
export default async function SettingsHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ device?: string }>;
}) {
  const { device: deviceId } = await searchParams;
  const supabase = await createClient();

  const { data: deviceRows } = await supabase
    .from("devices")
    .select("id, label, stock:stock_device_id(name, model_number)")
    .order("label");

  const devices = (deviceRows ?? []).map((d) => ({
    id: d.id,
    label: d.label ?? d.stock?.name ?? d.stock?.model_number ?? "Unlabeled device",
  }));

  let historyRows: {
    ts: string;
    setting_key: string;
    setting_value: string;
    previous_value: string | null;
    unit: string | null;
    applied_preset_key: string | null;
    written_by: string | null;
  }[] = [];
  let catalogNames = new Map<string, string>();
  let presetNames = new Map<string, string>();
  let writerNames = new Map<string, string>();

  if (deviceId) {
    const { data: settingsRows } = await supabase
      .from("device_settings")
      .select("ts, setting_key, setting_value, previous_value, unit, applied_preset_key, written_by")
      .eq("device_id", deviceId)
      .order("ts", { ascending: false })
      .limit(200);
    historyRows = settingsRows ?? [];

    const keys = Array.from(new Set(historyRows.map((r) => r.setting_key)));
    const presetKeys = Array.from(new Set(historyRows.map((r) => r.applied_preset_key).filter((k): k is string => Boolean(k))));
    const writerIds = Array.from(new Set(historyRows.map((r) => r.written_by).filter((id): id is string => Boolean(id))));

    const [{ data: catalogRows }, { data: presetRows }, { data: writerRows }] = await Promise.all([
      keys.length > 0 ? supabase.from("instrument_catalog").select("instrument_key, name").in("instrument_key", keys) : Promise.resolve({ data: [] }),
      presetKeys.length > 0 ? supabase.from("setting_presets").select("key, name").in("key", presetKeys) : Promise.resolve({ data: [] }),
      writerIds.length > 0 ? supabase.from("profiles").select("id, full_name, email").in("id", writerIds) : Promise.resolve({ data: [] }),
    ]);

    catalogNames = new Map((catalogRows ?? []).map((r) => [r.instrument_key, r.name]));
    presetNames = new Map((presetRows ?? []).map((r) => [r.key, r.name]));
    writerNames = new Map((writerRows ?? []).map((r) => [r.id, r.full_name ?? r.email]));
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/devices" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          Back to Stock Catalog
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Settings History</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every change to a device&apos;s settings — old value, new value, who, when, and whether it came from a preset.
          Read directly from device_settings&apos; own append-only log.
        </p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-2">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Device</label>
          <select
            name="device"
            defaultValue={deviceId ?? ""}
            className="h-9 min-w-64 rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="" disabled>
              Select a device…
            </option>
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="h-9 rounded-md border border-border bg-background px-3 text-sm hover:bg-accent">
          View history
        </button>
      </form>

      {deviceId && (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Setting</TableHead>
                <TableHead>Previous value</TableHead>
                <TableHead>New value</TableHead>
                <TableHead>Preset</TableHead>
                <TableHead>Written by</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historyRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    No settings have ever been written for this device.
                  </TableCell>
                </TableRow>
              ) : (
                historyRows.map((row, i) => (
                  <TableRow key={`${row.setting_key}-${row.ts}-${i}`}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {new Date(row.ts).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </TableCell>
                    <TableCell>
                      <p className="text-foreground">{catalogNames.get(row.setting_key) ?? row.setting_key}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {row.setting_key}
                        {row.unit ? ` (${row.unit})` : ""}
                      </p>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.previous_value ?? "— never set —"}</TableCell>
                    <TableCell className="font-medium text-foreground">{row.setting_value}</TableCell>
                    <TableCell>
                      {row.applied_preset_key ? (
                        <Badge variant="secondary">{presetNames.get(row.applied_preset_key) ?? row.applied_preset_key}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.written_by ? (writerNames.get(row.written_by) ?? "Unknown") : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
