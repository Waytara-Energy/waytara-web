import { Document, Line, Page, Polyline, Rect, StyleSheet, Svg, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { fmtDate } from "@/lib/savings";
import { formatValue, unitGroups, type CustomReport, type ReportSeries } from "./custom-report";
import { PdfLogo } from "./pdf-logo-image";

const PALETTE = ["#16A34A", "#3B82F6", "#F59E0B", "#8B5CF6", "#0D9488", "#EF4444"];

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
  table: { borderTop: "1 solid #E2E8F0" },
  tr: { flexDirection: "row", borderBottom: "1 solid #E2E8F0", paddingVertical: 4 },
  trHead: { flexDirection: "row", paddingVertical: 4, backgroundColor: "#F8FAFC", fontWeight: 700 },
  cName: { flex: 2.4 },
  cNum: { flex: 1.3, textAlign: "right" },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  swatch: { width: 8, height: 8, borderRadius: 2 },
  note: { color: "#64748B", fontSize: 8, marginTop: 4 },
  footer: { position: "absolute", bottom: 24, left: 38, right: 38, fontSize: 7.5, color: "#94A3B8" },
});

const colorOf = (report: CustomReport, s: ReportSeries) => PALETTE[report.series.indexOf(s) % PALETTE.length];

const W = 519;
const H = 140;
const M = { left: 6, right: 6, top: 8, bottom: 6 };

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const f = v / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}

/** Series sharing a unit on one chart: lines for several, or bars for one with a handful of points. */
function Chart({ report, series, unit }: { report: CustomReport; series: ReportSeries[]; unit: string }) {
  const n = report.buckets.length;
  const all = series.flatMap((s) => s.values).filter((v): v is number => v !== null);
  const lo = Math.min(0, ...all);
  const hi = niceMax(Math.max(0, ...all));
  const span = hi - lo || 1;
  const iw = W - M.left - M.right;
  const ih = H - M.top - M.bottom;
  const x = (i: number) => M.left + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => M.top + ih - ((v - lo) / span) * ih;
  const bars = series.length === 1 && n <= 40;
  const slot = iw / Math.max(n, 1);
  return (
    <View style={styles.section} wrap={false}>
      <Text style={styles.sectionTitle}>
        {series.map((s) => s.label).join(" and ")} · {unit}
      </Text>
      <Svg width={W} height={H}>
        {[0, 0.5, 1].map((f) => (
          <Line key={f} x1={M.left} x2={W - M.right} y1={M.top + ih * f} y2={M.top + ih * f} stroke="#E2E8F0" strokeWidth={0.6} />
        ))}
        {bars
          ? series[0].values.map((v, i) =>
              v === null ? null : <Rect key={i} x={M.left + i * slot + slot * 0.15} y={Math.min(y(v), y(0))} width={slot * 0.7} height={Math.abs(y(v) - y(0))} fill={colorOf(report, series[0])} />
            )
          : series.map((s) => {
              const pts = s.values.map((v, i) => (v === null ? null : `${x(i)},${y(v)}`)).filter((p): p is string => p !== null);
              return pts.length > 1 ? <Polyline key={s.id} points={pts.join(" ")} stroke={colorOf(report, s)} strokeWidth={1.6} fill="none" /> : null;
            })}
      </Svg>
      <View style={[styles.row, { justifyContent: "space-between" }]}>
        <Text style={styles.note}>{report.buckets[0]?.label ?? ""}</Text>
        <Text style={styles.note}>{report.buckets[n - 1]?.label ?? ""}</Text>
      </View>
      <View style={styles.legend}>
        {series.map((s) => (
          <View key={s.id} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: colorOf(report, s) }]} />
            <Text>{s.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Footer({ report }: { report: CustomReport }) {
  return (
    <Text style={styles.footer} fixed>
      Figures come from the inverter&apos;s own counters, not the electricity board&apos;s meter, and are estimates. {report.tariffNote ? `Tariff: ${report.tariffNote}. ` : ""}CO2: {report.co2Note}. Times are IST.
    </Text>
  );
}

function ReportDocument({ report }: { report: CustomReport }) {
  const fmt = (v: number | null, s: ReportSeries) => formatValue(v, s.unit, true);
  const when = `${fmtDate(report.period.from)} to ${fmtDate(report.period.to)}`;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <PdfLogo />
            <Text style={styles.title}>{report.name}</Text>
            <Text style={styles.sub}>{report.comparison ? "Comparison report" : "Report"} - {report.period.label}</Text>
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
              <Text style={styles.label}>Device</Text>
              <Text style={styles.value}>{report.deviceLabel}</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.label}>Period</Text>
            <Text style={styles.value}>
              {when} · {report.period.days} days, {report.daysWithReadings} with readings, by {report.granularity}
            </Text>
          </View>
          {report.previousPeriod && (
            <View style={styles.row}>
              <Text style={styles.label}>Compared with</Text>
              <Text style={styles.value}>
                {fmtDate(report.previousPeriod.from)} to {fmtDate(report.previousPeriod.to)}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>At a glance</Text>
          <View style={styles.table}>
            <View style={styles.trHead}>
              <Text style={styles.cName}>Parameter</Text>
              <Text style={styles.cNum}>Total</Text>
              <Text style={styles.cNum}>Average</Text>
              <Text style={styles.cNum}>Lowest</Text>
              <Text style={styles.cNum}>Highest</Text>
              {report.comparePrevious && <Text style={styles.cNum}>Change</Text>}
            </View>
            {report.series.map((s) => (
              <View style={styles.tr} key={s.id}>
                <Text style={styles.cName}>
                  {s.label} <Text style={{ color: "#94A3B8" }}>({s.categoryLabel})</Text>
                </Text>
                <Text style={styles.cNum}>{fmt(s.total, s)}</Text>
                <Text style={styles.cNum}>{fmt(s.avg, s)}</Text>
                <Text style={styles.cNum}>{fmt(s.min, s)}</Text>
                <Text style={styles.cNum}>{fmt(s.max, s)}</Text>
                {report.comparePrevious && <Text style={styles.cNum}>{s.changePct === null ? "-" : `${s.changePct > 0 ? "+" : ""}${s.changePct.toFixed(0)}%`}</Text>}
              </View>
            ))}
          </View>
          {report.series.some((s) => s.unit === "%") && <Text style={styles.note}>For a percentage the total is the whole period&apos;s own ratio, not a sum.</Text>}
        </View>

        {report.buckets.length > 0 &&
          unitGroups(report).map((g) => <Chart key={g.unit} report={report} series={g.series} unit={g.unit} />)}

        <Footer report={report} />
      </Page>

      {report.buckets.length > 0 && (
        <Page size="A4" style={styles.page}>
          <Text style={styles.sectionTitle}>{report.granularity === "month" ? "Month by month" : "Day by day"}</Text>
          <View style={styles.table}>
            <View style={styles.trHead} fixed>
              <Text style={styles.cName}>{report.granularity === "month" ? "Month" : "Day"}</Text>
              {report.series.map((s) => (
                <Text key={s.id} style={styles.cNum}>
                  {s.label} · {s.unit}
                </Text>
              ))}
            </View>
            {report.buckets.map((b, i) => (
              <View style={styles.tr} key={b.key} wrap={false}>
                <Text style={styles.cName}>{b.label}</Text>
                {report.series.map((s) => (
                  <Text key={s.id} style={styles.cNum}>
                    {s.values[i] === null ? "-" : formatValue(s.values[i], s.unit, true).replace(/ (kWh|kg)$/, "")}
                  </Text>
                ))}
              </View>
            ))}
          </View>
          <Footer report={report} />
        </Page>
      )}
    </Document>
  );
}

export async function generateCustomReportPdf(report: CustomReport): Promise<Buffer> {
  return renderToBuffer(<ReportDocument report={report} />);
}
