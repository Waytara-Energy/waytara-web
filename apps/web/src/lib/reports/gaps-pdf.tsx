import { StyleSheet, Text, View } from "@react-pdf/renderer";
import { GAP_EXPLANATION, type GapLine } from "@/lib/data-gaps";

const styles = StyleSheet.create({
  box: { marginBottom: 14, padding: 9, borderLeft: "3 solid #EF4444", backgroundColor: "#FEF2F2", borderRadius: 3 },
  title: { fontSize: 10, fontWeight: 700, color: "#991B1B" },
  summary: { fontSize: 8.5, color: "#7F1D1D", marginTop: 1 },
  note: { fontSize: 8, color: "#64748B", marginTop: 4, marginBottom: 5, lineHeight: 1.4 },
  head: { flexDirection: "row", paddingVertical: 3, borderBottom: "0.6 solid #FCA5A5", fontWeight: 700, fontSize: 8, color: "#7F1D1D" },
  row: { flexDirection: "row", paddingVertical: 2.5, borderBottom: "0.4 solid #FEE2E2", fontSize: 8.5 },
  cFrom: { flex: 3 },
  cTo: { flex: 3 },
  cLen: { flex: 1.6, textAlign: "right" },
  more: { fontSize: 8, color: "#7F1D1D", marginTop: 3 },
});

const MAX_ROWS = 14;

/** The "Data gaps" box of a PDF report: when the device sent no readings (offline, or its connection lost), each period on a row with its length,
 *  and a line saying what that means. Nothing is drawn when there are no gaps. */
export function PdfGaps({ lines, summary }: { lines: GapLine[]; summary: string }) {
  if (lines.length === 0) return null;
  const shown = lines.slice(0, MAX_ROWS);
  return (
    <View style={styles.box} wrap={false}>
      <Text style={styles.title}>Data gaps</Text>
      <Text style={styles.summary}>{summary}</Text>
      <Text style={styles.note}>{GAP_EXPLANATION}</Text>
      <View style={styles.head}>
        <Text style={styles.cFrom}>From</Text>
        <Text style={styles.cTo}>To</Text>
        <Text style={styles.cLen}>Length</Text>
      </View>
      {shown.map((l, i) => (
        <View key={i} style={styles.row}>
          <Text style={styles.cFrom}>{l.from}</Text>
          <Text style={styles.cTo}>{l.to}</Text>
          <Text style={styles.cLen}>{l.length}</Text>
        </View>
      ))}
      {lines.length > shown.length && <Text style={styles.more}>and {lines.length - shown.length} more periods</Text>}
    </View>
  );
}
