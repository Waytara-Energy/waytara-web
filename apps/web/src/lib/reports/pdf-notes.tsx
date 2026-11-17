import { Circle, Path, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import type { NoteIcon, ReportNote } from "./report-notes";

// The small print of a report PDF as a tidy grid: a round icon, a short bold title and one or two short lines in each cell, two cells across, with a hairline above.
// The icons are drawn as vector shapes (the built-in PDF font has no icon characters), in the same green as the rest of the report.

const GREEN = "#16A34A";

const styles = StyleSheet.create({
  wrap: { position: "absolute", bottom: 20, borderTop: "1 solid #E2E8F0", paddingTop: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: "50%", flexDirection: "row", paddingRight: 14, paddingBottom: 7 },
  bubble: { width: 18, height: 18, borderRadius: 9, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center", marginRight: 7 },
  text: { flex: 1 },
  title: { fontSize: 7.5, fontWeight: 700, color: "#334155", marginBottom: 1.5 },
  line: { fontSize: 7, lineHeight: 1.35, color: "#64748B" },
});

/** One icon on a 24 x 24 grid, drawn with a thin green line. */
function Icon({ name }: { name: NoteIcon }) {
  const line = { stroke: GREEN, strokeWidth: 2, fill: "none" as const, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <Svg width={11} height={11} viewBox="0 0 24 24">
      {name === "meter" && (
        <>
          <Circle cx={12} cy={12} r={9} {...line} />
          <Path d="M12 12 L16.5 7.5" {...line} />
        </>
      )}
      {name === "tag" && (
        <>
          <Path d="M3 12 V3 H12 L21 12 L12 21 Z" {...line} />
          <Circle cx={7.5} cy={7.5} r={1.2} fill={GREEN} stroke={GREEN} strokeWidth={1} />
        </>
      )}
      {name === "leaf" && (
        <>
          <Path d="M5 19 C5 9 11 4 20 4 C20 13 15 19 5 19 Z" {...line} />
          <Path d="M5 19 L13 11" {...line} />
        </>
      )}
      {name === "clock" && (
        <>
          <Circle cx={12} cy={12} r={9} {...line} />
          <Path d="M12 7 V12 L15.5 14" {...line} />
        </>
      )}
      {name === "bolt" && <Path d="M13 2 L4 14 H11 L10 22 L20 9 H13 Z" {...line} />}
      {name === "info" && (
        <>
          <Circle cx={12} cy={12} r={9} {...line} />
          <Path d="M12 11 V16" {...line} />
          <Circle cx={12} cy={7.6} r={0.7} fill={GREEN} stroke={GREEN} strokeWidth={1} />
        </>
      )}
    </Svg>
  );
}

/**
 * The footer of every page: the notes in a two-column grid. `margin` is the page's side padding, so the grid lines up with the rest of the page. The page needs about
 * 100 points of bottom padding so its content never runs under this.
 */
export function PdfNotes({ notes, margin }: { notes: ReportNote[]; margin: number }) {
  return (
    <View style={[styles.wrap, { left: margin, right: margin }]} fixed>
      <View style={styles.grid}>
        {notes.map((n) => (
          <View key={n.title} style={styles.cell} wrap={false}>
            <View style={styles.bubble}>
              <Icon name={n.icon} />
            </View>
            <View style={styles.text}>
              <Text style={styles.title}>{n.title}</Text>
              {n.lines.map((l, i) => (
                <Text key={i} style={styles.line}>
                  {l}
                </Text>
              ))}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Bottom padding that keeps a page's content clear of the notes. */
export const NOTES_PAGE_PADDING = 104;
