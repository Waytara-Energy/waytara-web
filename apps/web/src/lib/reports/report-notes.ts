// The small print at the foot of a report PDF, split into short labelled lines so it can be laid out as a tidy grid with an icon each, instead of one long grey
// paragraph. Pure (no drawing here), so the wording and the splitting of the stored notes are tested.

export type NoteIcon = "meter" | "tag" | "leaf" | "clock" | "bolt" | "info";

export interface ReportNote {
  icon: NoteIcon;
  title: string;
  lines: string[];
}

const sentence = (s: string) => {
  const t = s.trim().replace(/[.\s]+$/, "");
  return t ? `${t.charAt(0).toUpperCase()}${t.slice(1)}.` : "";
};

/**
 * The tariff note is stored as one phrase: "Tamil Nadu residential tariff, in force since 10 May 2026, indicative: not yet checked against the regulator order".
 * The part after ", indicative:" is a warning and gets a line of its own.
 */
export function tariffLines(note: string): string[] {
  const at = note.search(/,\s*indicative:/i);
  if (at === -1) return [sentence(note)].filter(Boolean);
  const main = note.slice(0, at);
  const warning = note.slice(at).replace(/^,\s*indicative:\s*/i, "");
  return [sentence(main), sentence(`Indicative: ${warning}`)].filter(Boolean);
}

/**
 * The CO2 note is stored as "0.71 kg CO2/kWh - CEA CO2 Baseline Database v21.0, weighted average, 2024-25, provisional": the factor, then where it comes from. The
 * source is cut after its name, so no line is long enough to wrap in the middle of a word: the factor, the name of the database, then what kind of figure it is.
 */
export function co2Lines(note: string): string[] {
  const m = note.match(/^(.+?)\s+-\s+(.+)$/);
  if (!m) return [sentence(note)].filter(Boolean);
  const [name, ...rest] = m[2].split(/,\s*/);
  return [m[1].trim(), name.trim(), rest.length > 0 ? sentence(rest.join(", ")) : ""].filter(Boolean);
}

const TIMES: ReportNote = { icon: "clock", title: "Times", lines: ["All times are IST (India)."] };

/** The notes under a report built from an inverter's counters (the custom report and the monthly statement). */
export function inverterNotes(a: { tariffNote?: string | null; co2Note?: string | null }): ReportNote[] {
  const notes: ReportNote[] = [{ icon: "meter", title: "Where the figures come from", lines: ["The inverter's own counters, not the electricity board's meter.", "They are estimates."] }];
  if (a.tariffNote && a.tariffNote.trim()) notes.push({ icon: "tag", title: "Tariff used", lines: tariffLines(a.tariffNote) });
  if (a.co2Note && a.co2Note.trim()) notes.push({ icon: "leaf", title: "CO2 factor", lines: co2Lines(a.co2Note) });
  notes.push(TIMES);
  return notes;
}

/** The notes under an EV charging report. */
export function evNotes(): ReportNote[] {
  return [
    { icon: "bolt", title: "Where the figures come from", lines: ["The charger's own meter and the sessions it reported.", "They are estimates."] },
    { icon: "info", title: "Sessions", lines: ["Test sessions are left out."] },
    TIMES,
  ];
}
