import { Document, Page, Text, View, StyleSheet, Svg, Rect, Line, Polyline, renderToBuffer } from "@react-pdf/renderer";
import type { DayReport } from "@/lib/report-day-data";
import type { ReportPoint, ReportSeries, ReportSeriesSummary } from "@/lib/report-types";

// The PDF can't read the dashboard's CSS variables, so each series has a fixed
// hex of the same hue family as the on-screen chart.
const PDF_COLORS: Record<string, string> = {
  solar: "#F59E0B",
  pv1: "#F59E0B",
  pv2: "#16A34A",
  pv3: "#8B5CF6",
  batteryCharge: "#16A34A",
  batteryDischarge: "#8B5CF6",
  batterySoc: "#16A34A",
  load: "#3B82F6",
  gridImport: "#3B82F6",
  gridExport: "#0D9488",
  inverterDcTemp: "#F59E0B",
  inverterAcTemp: "#3B82F6",
  batteryTemp: "#16A34A",
};
const colorOf = (id: string) => PDF_COLORS[id] ?? "#475569";

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9, fontFamily: "Helvetica", color: "#0F172A" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 14 },
  brand: { fontSize: 18, fontWeight: 700, color: "#16A34A" },
  meta: { textAlign: "right", color: "#475569" },
  title: { fontSize: 13, fontWeight: 700, marginBottom: 2 },
  sub: { color: "#64748B", marginBottom: 10 },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 10, fontWeight: 700, marginBottom: 6 },
  legend: { flexDirection: "row", gap: 12, marginBottom: 4, flexWrap: "wrap" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  swatch: { width: 8, height: 8, borderRadius: 2 },
  table: { borderTop: "1 solid #E2E8F0" },
  tr: { flexDirection: "row", borderBottom: "1 solid #E2E8F0", paddingVertical: 4 },
  trHead: { flexDirection: "row", paddingVertical: 4, backgroundColor: "#F8FAFC", fontWeight: 700 },
  cFirst: { flex: 2.4 },
  cNum: { flex: 1.3, textAlign: "right" },
  note: { color: "#64748B", fontSize: 8, marginTop: 4 },
  footer: { position: "absolute", bottom: 22, left: 36, right: 36, fontSize: 7.5, color: "#94A3B8" },
});

const CHART_W = 523;
const CHART_H = 190;
const M = { left: 34, right: 6, top: 8, bottom: 20 };

function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * exp;
}

function fmt(v: number | null, unit: string): string {
  if (v === null) return "-";
  return `${v.toFixed(unit === "kW" ? 2 : 1)} ${unit}`;
}

function DayChart({ report }: { report: DayReport }) {
  const series = report.type.series;
  const unit = series[0].unit;
  const pts = report.points;
  const values = pts.flatMap((p) => series.map((s) => p[s.id]).filter((v): v is number => typeof v === "number"));
  const dataMax = values.length ? Math.max(...values) : 0;
  const dataMin = values.length ? Math.min(...values) : 0;
  const isBar = series.every((s) => s.kind === "bar") && series.length <= 2; // 3+ series read better as lines (same rule as the on-screen chart)
  // Bars sit on zero; lines (SOC, temperatures) get a padded range of their own.
  const lo = isBar ? 0 : unit === "%" ? 0 : Math.floor(Math.min(dataMin, 0) / 5) * 5;
  const hi = unit === "%" ? 100 : niceCeil(Math.max(dataMax, 0.001));
  const plotW = CHART_W - M.left - M.right;
  const plotH = CHART_H - M.top - M.bottom;
  const y = (v: number) => M.top + plotH - ((v - lo) / (hi - lo || 1)) * plotH;
  const n = pts.length;
  const slot = plotW / n;
  const barSeries = series.filter((s) => s.kind === "bar");
  const barW = Math.max(0.6, (slot * 0.8) / Math.max(barSeries.length, 1));

  const ticks = [0, 1, 2, 3, 4].map((i) => lo + ((hi - lo) * i) / 4);
  const hourStep = 3;

  return (
    <View>
      <View style={styles.legend}>
        {series.map((s) => (
          <View key={s.id} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: colorOf(s.id) }]} />
            <Text>
              {s.label} ({s.unit})
            </Text>
          </View>
        ))}
      </View>
      <Svg width={CHART_W} height={CHART_H}>
        {ticks.map((t, i) => (
          <Line key={`g${i}`} x1={M.left} x2={CHART_W - M.right} y1={y(t)} y2={y(t)} stroke="#E2E8F0" strokeWidth={0.6} />
        ))}
        {ticks.map((t, i) => (
          <Text key={`yl${i}`} x={M.left - 4} y={y(t) + 2.5} style={{ fontSize: 7, fill: "#64748B", textAnchor: "end" }}>
            {unit === "kW" ? t.toFixed(t < 10 && t % 1 !== 0 ? 1 : 0) : t.toFixed(0)}
          </Text>
        ))}
        {Array.from({ length: 24 / hourStep + 1 }, (_, i) => i * hourStep).map((h) => {
          const x = M.left + (h / 24) * plotW;
          return (
            <Text key={`xl${h}`} x={x} y={CHART_H - 6} style={{ fontSize: 7, fill: "#64748B", textAnchor: h === 24 ? "end" : "middle" }}>
              {`${String(h).padStart(2, "0")}:00`}
            </Text>
          );
        })}
        {isBar
          ? pts.flatMap((p, i) =>
              barSeries.map((s, si) => {
                const v = p[s.id];
                if (typeof v !== "number" || v <= 0) return null;
                const h = Math.max(0.5, y(0) - y(v));
                return (
                  <Rect key={`${i}-${s.id}`} x={M.left + i * slot + slot * 0.1 + si * barW} y={y(v)} width={barW} height={h} fill={colorOf(s.id)} />
                );
              })
            )
          : series.map((s) => {
              // A gap (no reading) breaks the line rather than being drawn as zero.
              const runs: string[][] = [];
              let cur: string[] = [];
              pts.forEach((p, i) => {
                const v = p[s.id];
                if (typeof v === "number") cur.push(`${M.left + i * slot + slot / 2},${y(v)}`);
                else if (cur.length) {
                  runs.push(cur);
                  cur = [];
                }
              });
              if (cur.length) runs.push(cur);
              return runs.map((r, ri) => <Polyline key={`${s.id}-${ri}`} points={r.join(" ")} stroke={colorOf(s.id)} strokeWidth={1.4} fill="none" />);
            })}
        <Line x1={M.left} x2={CHART_W - M.right} y1={y(lo)} y2={y(lo)} stroke="#94A3B8" strokeWidth={0.8} />
      </Svg>
    </View>
  );
}

function SummaryTable({ report }: { report: DayReport }) {
  const kw = report.summaries.some((s) => s.unit === "kW");
  return (
    <View style={styles.table}>
      <View style={styles.trHead}>
        <Text style={styles.cFirst}>Series</Text>
        {kw && <Text style={styles.cNum}>Energy (meter)</Text>}
        {kw && <Text style={styles.cNum}>Energy (est.)</Text>}
        <Text style={styles.cNum}>Peak</Text>
        <Text style={styles.cNum}>Peak at</Text>
        <Text style={styles.cNum}>Average</Text>
        <Text style={styles.cNum}>Lowest</Text>
      </View>
      {report.summaries.map((s: ReportSeriesSummary) => (
        <View style={styles.tr} key={s.id}>
          <Text style={styles.cFirst}>{s.label}</Text>
          {kw && <Text style={styles.cNum}>{s.counterKwh !== null ? `${s.counterKwh.toFixed(1)} kWh` : "-"}</Text>}
          {kw && <Text style={styles.cNum}>{s.energyKwh !== null ? `${s.energyKwh.toFixed(1)} kWh` : "-"}</Text>}
          <Text style={styles.cNum}>{fmt(s.max, s.unit)}</Text>
          <Text style={styles.cNum}>{s.maxAt ?? "-"}</Text>
          <Text style={styles.cNum}>{fmt(s.avg, s.unit)}</Text>
          <Text style={styles.cNum}>{fmt(s.min, s.unit)}</Text>
        </View>
      ))}
    </View>
  );
}

function hourlyRows(points: ReportPoint[], series: ReportSeries[]) {
  return Array.from({ length: 24 }, (_, h) => {
    const prefix = `T${String(h).padStart(2, "0")}:`;
    const inHour = points.filter((p) => p.time.slice(10, 13) === prefix);
    const cells = series.map((s) => {
      const vals = inHour.map((p) => p[s.id]).filter((v): v is number => typeof v === "number");
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    });
    return { hour: `${String(h).padStart(2, "0")}:00 - ${String(h).padStart(2, "0")}:59`, cells };
  });
}

function formatLongDate(date: string): string {
  return new Date(`${date}T12:00:00+05:30`).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

function DayDocument({ report, generatedAt }: { report: DayReport; generatedAt: string }) {
  const series = report.type.series;
  const rows = hourlyRows(report.points, series);
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>WayTara Energy</Text>
          <View style={styles.meta}>
            <Text>Daily Energy Report</Text>
            <Text>Generated {new Date(generatedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</Text>
          </View>
        </View>

        <Text style={styles.title}>{report.type.label}</Text>
        <Text style={styles.sub}>
          {formatLongDate(report.date)} - 00:00 to 23:59 IST - {report.customerName}
          {report.deviceLabel ? ` - ${report.deviceLabel}` : ""}
        </Text>

        <View style={styles.section}>
          <DayChart report={report} />
          <Text style={styles.note}>
            {report.coarse
              ? "Hourly averages (detailed readings are only kept for 90 days)."
              : `Each ${report.bucketMinutes < 60 ? `${report.bucketMinutes}-minute` : "1-hour"} interval shows the average over that interval.`}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <SummaryTable report={report} />
          {series.some((s) => s.counterKey) && (
            <Text style={styles.note}>
              Energy (meter) is the inverter&apos;s own count for the day. Energy (est.) adds up the interval averages and can differ slightly.
            </Text>
          )}
        </View>

        <Text style={styles.footer} fixed>
          WayTara Energy Systems - Figures come from your device&apos;s readings. Contact your WayTara advisor with any questions.
        </Text>
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>Hourly averages - {report.date}</Text>
        <View style={styles.table}>
          <View style={styles.trHead}>
            <Text style={styles.cFirst}>Hour</Text>
            {series.map((s) => (
              <Text key={s.id} style={styles.cNum}>
                {s.label} ({s.unit})
              </Text>
            ))}
          </View>
          {rows.map((r) => (
            <View style={styles.tr} key={r.hour} wrap={false}>
              <Text style={styles.cFirst}>{r.hour}</Text>
              {r.cells.map((c, i) => (
                <Text key={series[i].id} style={styles.cNum}>
                  {c === null ? "-" : c.toFixed(series[i].unit === "kW" ? 2 : 1)}
                </Text>
              ))}
            </View>
          ))}
        </View>
        <Text style={styles.footer} fixed>
          WayTara Energy Systems - Figures come from your device&apos;s readings. Contact your WayTara advisor with any questions.
        </Text>
      </Page>
    </Document>
  );
}

export async function generateDayReportPdf(report: DayReport, generatedAt: string): Promise<Buffer> {
  return renderToBuffer(<DayDocument report={report} generatedAt={generatedAt} />);
}
