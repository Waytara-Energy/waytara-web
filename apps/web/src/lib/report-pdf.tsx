import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

export interface ReportWeekRow {
  label: string; // e.g. "18 Aug – 24 Aug"
  kwh: number;
}

export interface ReportPdfData {
  customerName: string;
  planName: string;
  deviceLabel: string | null;
  generatedAt: string;
  periodLabel: string;
  totalKwh: number;
  totalSaved: number;
  totalInvested: number;
  roiPct: number | null;
  tariffRate: number;
  weeks: ReportWeekRow[];
}

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#0F172A" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  brand: { fontSize: 18, fontWeight: 700, color: "#16A34A" },
  meta: { textAlign: "right", color: "#475569" },
  section: { marginBottom: 18 },
  sectionTitle: { fontSize: 11, fontWeight: 700, marginBottom: 8, color: "#0F172A" },
  statsRow: { flexDirection: "row", gap: 16 },
  statBox: {
    flex: 1,
    borderRadius: 4,
    backgroundColor: "#F8FAFC",
    padding: 10,
  },
  statLabel: { color: "#64748B", fontSize: 8, marginBottom: 4 },
  statValue: { fontSize: 14, fontWeight: 700, color: "#0F172A" },
  row: { flexDirection: "row" },
  label: { color: "#64748B", width: 110 },
  value: { flex: 1 },
  table: { marginTop: 4, borderTop: "1 solid #E2E8F0" },
  tableRow: { flexDirection: "row", borderBottom: "1 solid #E2E8F0", paddingVertical: 6 },
  tableHeaderRow: {
    flexDirection: "row",
    paddingVertical: 6,
    backgroundColor: "#F8FAFC",
    fontWeight: 700,
  },
  colLabel: { flex: 3 },
  colValue: { flex: 1.5, textAlign: "right" },
  footer: { position: "absolute", bottom: 30, left: 40, right: 40, fontSize: 8, color: "#94A3B8" },
});

function formatKwh(value: number): string {
  return `${value.toFixed(1)} kWh`;
}

// "Rs." not "₹" — the PDF's base Helvetica font (WinAnsiEncoding) has no
// ₹ glyph, so it silently substitutes a stray superscript-1 character.
// Confirmed by rendering and looking at the actual output. The web UI
// uses the real ₹ symbol fine (browser fonts cover it); only the PDF's
// font is the constraint.
function formatInr(value: number): string {
  return `Rs. ${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function ReportDocument({ data }: { data: ReportPdfData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>WayTara Energy</Text>
          <View style={styles.meta}>
            <Text>Household Energy Report</Text>
            <Text>{data.periodLabel}</Text>
            <Text>Generated {new Date(data.generatedAt).toLocaleDateString("en-IN")}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Customer</Text>
            <Text style={styles.value}>{data.customerName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Plan</Text>
            <Text style={styles.value}>{data.planName}</Text>
          </View>
          {data.deviceLabel && (
            <View style={styles.row}>
              <Text style={styles.label}>Device</Text>
              <Text style={styles.value}>{data.deviceLabel}</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.label}>Tariff rate used</Text>
            <Text style={styles.value}>Rs. {data.tariffRate.toFixed(2)}/kWh</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>ENERGY GENERATED</Text>
              <Text style={styles.statValue}>{formatKwh(data.totalKwh)}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>SAVED TO DATE</Text>
              <Text style={styles.statValue}>{formatInr(data.totalSaved)}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>TOTAL INVESTED</Text>
              <Text style={styles.statValue}>{formatInr(data.totalInvested)}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>ROI</Text>
              <Text style={styles.statValue}>{data.roiPct !== null ? `${data.roiPct.toFixed(0)}%` : "—"}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Weekly yield</Text>
          <View style={styles.table}>
            <View style={styles.tableHeaderRow}>
              <Text style={styles.colLabel}>Week</Text>
              <Text style={styles.colValue}>Yield</Text>
            </View>
            {data.weeks.map((week, i) => (
              <View style={styles.tableRow} key={i}>
                <Text style={styles.colLabel}>{week.label}</Text>
                <Text style={styles.colValue}>{formatKwh(week.kwh)}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.footer}>
          WayTara Energy Systems · Figures are estimates based on device telemetry and the tariff rate
          on file for this account. Contact your WayTara advisor with any questions.
        </Text>
      </Page>
    </Document>
  );
}

export async function generateReportPdf(data: ReportPdfData): Promise<Buffer> {
  return renderToBuffer(<ReportDocument data={data} />);
}
