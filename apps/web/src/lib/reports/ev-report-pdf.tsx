import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { fmtDate } from "@/lib/savings";
import { formatSeconds, sessionStatusLabel } from "@/lib/ev-sessions";
import { PdfLogo } from "./pdf-logo-image";
import { evSummaryFigures, istStamp, type EvReport } from "./ev-report";

const styles = StyleSheet.create({
  page: { padding: 38, paddingBottom: 56, fontSize: 9, fontFamily: "Helvetica", color: "#0F172A" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  meta: { textAlign: "right", color: "#475569" },
  title: { fontSize: 15, fontWeight: 700, marginTop: 2 },
  sub: { color: "#64748B", marginTop: 2 },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 10.5, fontWeight: 700, marginBottom: 6 },
  row: { flexDirection: "row" },
  label: { color: "#64748B", width: 90 },
  value: { flex: 1 },
  figures: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  figure: { width: 118, padding: 8, backgroundColor: "#F8FAFC", borderRadius: 4 },
  figureLabel: { color: "#64748B", fontSize: 8 },
  figureValue: { fontSize: 13, fontWeight: 700, marginTop: 2 },
  table: { borderTop: "1 solid #E2E8F0" },
  tr: { flexDirection: "row", borderBottom: "1 solid #E2E8F0", paddingVertical: 4 },
  trHead: { flexDirection: "row", paddingVertical: 4, backgroundColor: "#F8FAFC", fontWeight: 700 },
  cWhen: { flex: 2.2 },
  cNum: { flex: 1.1, textAlign: "right" },
  cText: { flex: 1.5, paddingLeft: 8 },
  note: { color: "#64748B", fontSize: 8, marginTop: 4 },
  footer: { position: "absolute", bottom: 24, left: 38, right: 38, fontSize: 7.5, color: "#94A3B8" },
});

function ReportDocument({ report }: { report: EvReport }) {
  const s = report.stats;
  const rows = s.rows.slice().reverse();
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <PdfLogo />
            <Text style={styles.title}>EV charging report</Text>
            <Text style={styles.sub}>
              {fmtDate(report.from)} to {fmtDate(report.to)}
            </Text>
          </View>
          <View style={styles.meta}>
            <Text>Generated {new Date(report.generatedAt).toLocaleDateString("en-IN")}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.label}>Customer</Text>
            <Text style={styles.value}>{report.customerName}</Text>
          </View>
          {report.siteName && (
            <View style={styles.row}>
              <Text style={styles.label}>Site</Text>
              <Text style={styles.value}>{report.siteName}</Text>
            </View>
          )}
          {report.deviceLabel && (
            <View style={styles.row}>
              <Text style={styles.label}>Charger</Text>
              <Text style={styles.value}>{report.deviceLabel}</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.label}>Period</Text>
            <Text style={styles.value}>
              {fmtDate(report.from)} to {fmtDate(report.to)} · {report.days} {report.days === 1 ? "day" : "days"}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <View style={styles.figures}>
            {evSummaryFigures(report).map((f) => (
              <View key={f.label} style={styles.figure}>
                <Text style={styles.figureLabel}>{f.label}</Text>
                <Text style={styles.figureValue}>{f.value}</Text>
              </View>
            ))}
          </View>
          {s.cost && <Text style={styles.note}>Priced at Rs. {s.cost.rate.toFixed(2)} per kWh{report.tariffNote ? ` (${report.tariffNote})` : ""}. Energy with no source split counts as grid.</Text>}
          {s.sources.unknownKwh > 0.05 && <Text style={styles.note}>{s.sources.unknownKwh.toFixed(1)} kWh could not be matched to a source (the home&apos;s figures were not available at the time).</Text>}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Charging sessions</Text>
          {rows.length === 0 ? (
            <Text style={styles.note}>No charging sessions in this period.</Text>
          ) : (
            <View style={styles.table}>
              <View style={styles.trHead} fixed>
                <Text style={styles.cWhen}>Started (IST)</Text>
                <Text style={styles.cNum}>Energy</Text>
                <Text style={styles.cNum}>Time</Text>
                <Text style={styles.cNum}>Peak</Text>
                <Text style={styles.cNum}>Solar</Text>
                <Text style={styles.cText}>Status</Text>
              </View>
              {rows.map((r) => (
                <View style={styles.tr} key={r.id} wrap={false}>
                  <Text style={styles.cWhen}>{istStamp(r.startedAt)}</Text>
                  <Text style={styles.cNum}>{r.energyKwh === null ? "-" : `${r.energyKwh.toFixed(1)} kWh`}</Text>
                  <Text style={styles.cNum}>{formatSeconds(r.durationS)}</Text>
                  <Text style={styles.cNum}>{r.peakKw === null ? "-" : `${r.peakKw.toFixed(1)} kW`}</Text>
                  <Text style={styles.cNum}>{r.solarSharePct === null ? "-" : `${r.solarSharePct.toFixed(0)}%`}</Text>
                  <Text style={styles.cText}>{sessionStatusLabel(r.status).label}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <Text style={styles.footer} fixed>
          Figures come from the charger&apos;s own meter and the sessions it reported, and are estimates. Test sessions are left out. Times are IST.
        </Text>
      </Page>
    </Document>
  );
}

export async function generateEvReportPdf(report: EvReport): Promise<Buffer> {
  return renderToBuffer(<ReportDocument report={report} />);
}
