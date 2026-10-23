"use client";

import * as React from "react";
import { Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CONFIG_KEYS, CONFIG_KEY_NAMES, configStatusText, shownValue, validateConfigValue } from "@/lib/ev-settings";
import { hubJson } from "./ev-settings-hub";

type Row = { key: string; value: string | null; readonly: boolean };

/** The charger's own settings (OCPP configuration), read through the service on request. Staff can change the writable ones; the owner only reads. */
export function EvSettingsConfig({ chargerId, canEdit }: { chargerId: string; canEdit: boolean }) {
  const [rows, setRows] = React.useState<Row[] | null>(null);
  const [unknown, setUnknown] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [note, setNote] = React.useState<{ ok: boolean; text: string } | null>(null);
  const [editing, setEditing] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function read() {
    setLoading(true);
    setNote(null);
    const r = await hubJson<{ configuration: Row[]; unknown?: string[] }>("GET", `/v1/ev/${encodeURIComponent(chargerId)}/configuration?keys=${CONFIG_KEY_NAMES.join(",")}`);
    setLoading(false);
    if (!r.ok) {
      // an older service does not have this call yet: say so instead of the generic "not found"
      setNote({ ok: false, text: r.status === 404 ? "Reading the charger's settings is not available on the service yet." : r.message });
      return;
    }
    setRows(r.data.configuration);
    setUnknown(r.data.unknown ?? []);
  }

  async function save(key: string) {
    const v = validateConfigValue(key, draft);
    if (!v.ok) {
      setNote({ ok: false, text: v.message });
      return;
    }
    setSaving(true);
    setNote(null);
    const r = await hubJson<{ status: string }>("POST", `/v1/ev/${encodeURIComponent(chargerId)}/configuration`, { key, value: v.value });
    setSaving(false);
    if (!r.ok) {
      setNote({ ok: false, text: r.status === 404 ? "Changing the charger's settings is not available on the service yet." : r.message });
      return;
    }
    const said = configStatusText(r.data.status);
    setNote(said);
    if (said.ok) {
      setRows((list) => (list ?? []).map((x) => (x.key === key ? { ...x, value: v.value } : x)));
      setEditing(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => void read()} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : null}
          Read from the charger
        </Button>
        <span className="text-xs text-muted-foreground">{canEdit ? "WayTara staff can change these." : "Only WayTara staff can change these."}</span>
      </div>

      {rows ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Setting</TableHead>
              <TableHead className="text-right">Value</TableHead>
              {canEdit ? <TableHead className="w-12" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {CONFIG_KEYS.map((meta) => {
              const row = rows.find((r) => r.key === meta.key);
              const missing = !row || unknown.includes(meta.key);
              return (
                <TableRow key={meta.key}>
                  <TableCell>
                    <p className="text-sm font-medium">{meta.label}</p>
                    <p className="text-xs text-muted-foreground">{meta.help}</p>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {editing === meta.key ? (
                      <div className="flex items-center justify-end gap-2">
                        <Input className="h-8 w-40" value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus aria-label={meta.label} />
                        <Button size="sm" onClick={() => void save(meta.key)} disabled={saving}>
                          {saving ? <Loader2 className="size-4 animate-spin" /> : "Save"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(null)} disabled={saving}>
                          Cancel
                        </Button>
                      </div>
                    ) : missing ? (
                      <span className="text-muted-foreground">Not on this charger</span>
                    ) : (
                      shownValue(meta, row?.value)
                    )}
                  </TableCell>
                  {canEdit ? (
                    <TableCell>
                      {!missing && !row?.readonly && editing !== meta.key ? (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8"
                          aria-label={`Change ${meta.label}`}
                          onClick={() => {
                            setEditing(meta.key);
                            setDraft(row?.value ?? "");
                            setNote(null);
                          }}
                        >
                          <Pencil className="size-4" />
                        </Button>
                      ) : null}
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      ) : (
        <p className="text-sm text-muted-foreground">Press the button to ask the charger for its settings. The charger must be connected.</p>
      )}

      {note ? (
        <p role={note.ok ? "status" : "alert"} className={note.ok ? "text-sm text-emerald-600 dark:text-emerald-400" : "text-sm text-destructive"}>
          {note.text}
        </p>
      ) : null}
    </div>
  );
}
