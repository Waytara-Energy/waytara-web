import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { PETROL_CAR } from "@/lib/emission-factor";
import { CO2_KG_PER_TREE_PER_YEAR } from "@/lib/environmental-impact";
import { dayGapLines, dayGapsSummary } from "@/lib/data-gaps";
import { fmtDate } from "@/lib/savings";
import { PdfLogo } from "./pdf-logo-image";
import { PdfGaps } from "./gaps-pdf";
import { NOTES_PAGE_PADDING, PdfNotes } from "./pdf-notes";
import { inverterNotes } from "./report-notes";
import { fmtCo2, type CarbonPack } from "./carbon-data";

const styles = StyleSheet.create({
  page: { padding: 40, paddingBottom: NOTES_PAGE_PADDING, fontSize: 10, fontFamily: "Helvetica", color: "#0F172A" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 18 },
  meta: { textAlign: "right", color: "#475569" },
  title: { fontSize: 13, fontWeight: 700, marginTop: 2 },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 11, fontWeight: 700, marginBottom: 6 },
  row: { flexDirection: "row" },
  label: { color: "#64748B", width: 110 },
  value: { flex: 1 },
  statsRow: { flexDirection: "row", gap: 10 },
  statBox: { flex: 1, borderRadius: 4, backgroundColor: "#F8FAFC", padding: 10 },
  statBoxGreen: { flex: 1, borderRadius: 4, backgroundColor: "#ECFDF5", padding: 10 },
  statLabel: { color: "#64748B", fontSize: 8, marginBottom: 4 },
  statValue: { fontSize: 15, fontWeight: 700 },
  statHint: { color: "#64748B", fontSize: 8, marginTop: 3 },
  table: { marginTop: 2, borderTop: "1 solid #E2E8F0" },
  tableRow: { flexDirection: "row", borderBottom: "1 solid #E2E8F0", paddingVertical: 4 },
  tableHead: { flexDirection: "row", paddingVertical: 5, backgroundColor: "#F8FAFC", fontWeight: 700 },
  cName: { flex: 1.6 },
  cNum: { flex: 1.2, textAlign: "right" },
  note: { color: "#64748B", fontSize: 8, marginTop: 4 },
  bullet: { flexDirection: "row", marginBottom: 3 },
  dot: { width: 10, color: "#16A34A" },
  bulletText: { flex: 1, fontSize: 9, lineHeight: 1.35 },
});

const kwh = (v: number) => `${v.toFixed(v >= 100 ? 0 : 1)} kWh`;

function Bullets({ items }: { items: string[] }) {
  return (
    <View>
      {items.map((t, i) => (
        <View key={i} style={styles.bullet} wrap={false}>
          <Text style={styles.dot}>-</Text>
          <Text style={styles.bulletText}>{t}</Text>
        </View>
      ))}
    </View>
  );
}

function Footer({ p }: { p: CarbonPack }) {
  // the tariff does not enter this report, so its note is left out
  return <PdfNotes notes={inverterNotes({ tariffNote: null, co2Note: p.factor.note })} margin={40} />;
}

function Pack({ p }: { p: CarbonPack }) {
  const t = p.totals;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <PdfLogo />
            <Text style={styles.title}>Carbon and sustainability report</Text>
          </View>
          <View style={styles.meta}>
            <Text>{p.period.label}</Text>
            <Text>Generated {new Date(p.generatedAt).toLocaleDateString("en-IN")}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.label}>Customer</Text>
            <Text style={styles.value}>{p.customerName}</Text>
          </View>
          {p.siteName && (
            <View style={styles.row}>
              <Text style={styles.label}>Site</Text>
              <Text style={styles.value}>{p.siteName}</Text>
            </View>
          )}
          {p.deviceLabel && (
            <View style={styles.row}>
              <Text style={styles.label}>Device</Text>
              <Text style={styles.value}>{p.deviceLabel}</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.label}>Period</Text>
            <Text style={styles.value}>
              {fmtDate(p.period.from)} to {fmtDate(p.period.to)}
              {p.period.partial ? ", so far" : ""}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Days with readings</Text>
            <Text style={styles.value}>
              {t.days} of {t.daysInPeriod} - {t.completeness}% of the period
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Report ID</Text>
            <Text style={styles.value}>
              {p.id} - method version {p.methodVersion}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.statsRow}>
            <View style={styles.statBoxGreen}>
              <Text style={styles.statLabel}>CO2 AVOIDED</Text>
              <Text style={styles.statValue}>{fmtCo2(t.co2AvoidedKg)}</Text>
              <Text style={styles.statHint}>by the solar generated</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>SOLAR GENERATED</Text>
              <Text style={styles.statValue}>{kwh(t.pvKwh)}</Text>
              <Text style={styles.statHint}>{t.days > 0 ? `${(t.pvKwh / t.days).toFixed(1)} kWh a day with readings` : " "}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>EQUAL TO</Text>
              <Text style={styles.statValue}>{t.trees.toFixed(t.trees >= 100 ? 0 : 1)} trees</Text>
              <Text style={styles.statHint}>absorbing CO2 for a year</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>EQUAL TO</Text>
              <Text style={styles.statValue}>{Math.round(t.carKm).toLocaleString("en-IN")} km</Text>
              <Text style={styles.statHint}>not driven in a petrol car</Text>
            </View>
          </View>
          {p.sinceCommissioning && (
            <Text style={styles.note}>
              Since the system was commissioned (from the inverter&apos;s lifetime counter): {kwh(p.sinceCommissioning.pvKwh)} generated, {fmtCo2(p.sinceCommissioning.co2AvoidedKg)} of CO2 avoided.
            </Text>
          )}
        </View>

        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>Grid electricity bought: Scope 2 estimate (location-based)</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>BOUGHT FROM THE GRID</Text>
              <Text style={styles.statValue}>{kwh(t.importKwh)}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>CO2 FROM THAT ELECTRICITY</Text>
              <Text style={styles.statValue}>{fmtCo2(t.gridCo2Kg)}</Text>
              <Text style={styles.statHint}>at the same grid factor</Text>
            </View>
          </View>
          <Text style={styles.note}>For companies that report Scope 2. Market-based Scope 2, which uses renewable certificates you hold, is not included.</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Month by month</Text>
          <View style={styles.table}>
            <View style={styles.tableHead}>
              <Text style={styles.cName}>Month</Text>
              <Text style={styles.cNum}>Days with data</Text>
              <Text style={styles.cNum}>Generated kWh</Text>
              <Text style={styles.cNum}>CO2 avoided kg</Text>
              <Text style={styles.cNum}>Bought kWh</Text>
              <Text style={styles.cNum}>Grid CO2 kg</Text>
            </View>
            {p.months.map((m) => (
              <View style={styles.tableRow} key={m.month} wrap={false}>
                <Text style={styles.cName}>{m.label}</Text>
                <Text style={styles.cNum}>
                  {m.days} of {m.daysInPeriod}
                </Text>
                <Text style={styles.cNum}>{m.pvKwh.toFixed(1)}</Text>
                <Text style={styles.cNum}>{m.co2AvoidedKg.toFixed(1)}</Text>
                <Text style={styles.cNum}>{m.importKwh.toFixed(1)}</Text>
                <Text style={styles.cNum}>{m.gridCo2Kg.toFixed(1)}</Text>
              </View>
            ))}
            <View style={[styles.tableRow, { fontWeight: 700 }]}>
              <Text style={styles.cName}>Total</Text>
              <Text style={styles.cNum}>
                {t.days} of {t.daysInPeriod}
              </Text>
              <Text style={styles.cNum}>{t.pvKwh.toFixed(1)}</Text>
              <Text style={styles.cNum}>{t.co2AvoidedKg.toFixed(1)}</Text>
              <Text style={styles.cNum}>{t.importKwh.toFixed(1)}</Text>
              <Text style={styles.cNum}>{t.gridCo2Kg.toFixed(1)}</Text>
            </View>
          </View>
        </View>

        <Footer p={p} />
      </Page>

      <Page size="A4" style={styles.page}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How the figures are worked out</Text>
          <Bullets
            items={[
              "CO2 avoided = the solar energy generated (kWh) x the grid emission factor: what the same electricity would have given off if it had come from the grid.",
              `Factor used: ${p.factor.note}. It is the latest national figure we hold and is replaced when a newer one is published.`,
              `Trees = CO2 avoided / ${CO2_KG_PER_TREE_PER_YEAR} (one tree absorbs about ${CO2_KG_PER_TREE_PER_YEAR} kg of CO2 a year). Distance: ${PETROL_CAR.note}. Both are estimates.`,
              "Grid CO2 (the Scope 2 estimate) = the grid electricity bought (kWh) x the same factor, a location-based method.",
              "A day with no reading counts as nothing generated or bought. Where the device was offline the figures are missing, not zero: see the gaps below.",
            ]}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What this report is, and is not</Text>
          <Bullets
            items={[
              "It is a record of measured solar generation and an estimate of the CO2 it avoided, with the method stated, for your own reporting, a lender, an auditor or an aggregator.",
              "It is not a carbon credit and has not been verified. Credits and certificates (CCTS, REC, I-REC, Verra, Gold Standard) need a registered project, an approved method and independent verification.",
              "If this generation is, or will be, claimed for a certificate, a subsidy or another scheme, the same CO2 must not be counted twice.",
              "The figures come from the inverter's own counters, not the electricity board's revenue-grade meter. Some schemes ask for the board's meter data instead.",
            ]}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>The data behind it</Text>
          <Bullets
            items={[
              `${t.days} of ${t.daysInPeriod} days in the period have readings (${t.completeness}%). The daily history on file goes back about two years, so an older period can be less complete. The CSV lists every day.`,
              "WayTara does not hold meter calibration records, the electricity board's meter readings, or ownership and registration documents. A verifier will ask for them.",
            ]}
          />
          <PdfGaps lines={dayGapLines(p.gaps)} summary={dayGapsSummary(p.gaps)} />
        </View>

        <Footer p={p} />
      </Page>
    </Document>
  );
}

export async function generateCarbonPdf(pack: CarbonPack): Promise<Buffer> {
  return renderToBuffer(<Pack p={pack} />);
}
