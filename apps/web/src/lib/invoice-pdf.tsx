import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { PdfLogo } from "@/lib/reports/pdf-logo-image";
import type { InvoiceData, InvoiceParty } from "./invoice";

const styles = StyleSheet.create({
  page: { padding: 40, paddingBottom: 70, fontSize: 10, fontFamily: "Helvetica", color: "#0F172A" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 22 },
  title: { fontSize: 16, fontWeight: 700, color: "#16A34A", marginTop: 4 },
  meta: { textAlign: "right", color: "#475569", lineHeight: 1.5 },
  parties: { flexDirection: "row", gap: 24, marginBottom: 20 },
  party: { flex: 1 },
  partyTitle: { fontSize: 8, fontWeight: 700, color: "#64748B", marginBottom: 4, letterSpacing: 1 },
  partyName: { fontSize: 11, fontWeight: 700, marginBottom: 2 },
  line: { color: "#334155", lineHeight: 1.45 },
  table: { borderTop: "1 solid #E2E8F0", marginBottom: 6 },
  head: { flexDirection: "row", paddingVertical: 6, backgroundColor: "#F8FAFC", fontWeight: 700 },
  tr: { flexDirection: "row", borderBottom: "1 solid #E2E8F0", paddingVertical: 8 },
  cDesc: { flex: 4, paddingRight: 8 },
  cAmt: { flex: 1.6, textAlign: "right" },
  sub: { color: "#64748B", fontSize: 8.5, marginTop: 2 },
  totals: { alignSelf: "flex-end", width: 240, marginTop: 8 },
  tot: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  totLabel: { color: "#64748B" },
  grand: { flexDirection: "row", justifyContent: "space-between", borderTop: "1 solid #E2E8F0", marginTop: 4, paddingTop: 6, fontWeight: 700, fontSize: 12 },
  box: { marginTop: 20, borderRadius: 4, backgroundColor: "#F8FAFC", padding: 10 },
  boxTitle: { fontSize: 8, fontWeight: 700, color: "#64748B", marginBottom: 5, letterSpacing: 1 },
  row: { flexDirection: "row", paddingVertical: 1.5 },
  label: { color: "#64748B", width: 120 },
  value: { flex: 1 },
  paid: { alignSelf: "flex-start", marginTop: 6, color: "#16A34A", fontWeight: 700, fontSize: 11 },
  footer: { position: "absolute", bottom: 30, left: 40, right: 40, fontSize: 7.5, color: "#94A3B8", lineHeight: 1.5 },
});

// "Rs." and not the rupee sign: the PDF's base Helvetica font has no glyph for it (it prints a stray character).
const rs = (n: number) => `Rs. ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

function Party({ title, party, extra }: { title: string; party: InvoiceParty; extra?: string | null }) {
  return (
    <View style={styles.party}>
      <Text style={styles.partyTitle}>{title}</Text>
      <Text style={styles.partyName}>{party.name}</Text>
      {party.address.map((l) => (
        <Text key={l} style={styles.line}>
          {l}
        </Text>
      ))}
      {party.email ? <Text style={styles.line}>{party.email}</Text> : null}
      {extra ? <Text style={styles.line}>{extra}</Text> : null}
      {party.gstin ? <Text style={styles.line}>GSTIN: {party.gstin}</Text> : null}
    </View>
  );
}

function InvoiceDocument({ d }: { d: InvoiceData }) {
  return (
    <Document title={`Invoice ${d.number}`} author="WayTara Energy">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <PdfLogo />
            <Text style={styles.title}>{d.seller.gstin ? "Tax invoice" : "Invoice"}</Text>
          </View>
          <View style={styles.meta}>
            <Text>Invoice no. {d.number}</Text>
            <Text>Date {day(d.issuedAt)}</Text>
            {d.quotationRef ? <Text>Quotation #{d.quotationRef}</Text> : null}
          </View>
        </View>

        <View style={styles.parties}>
          <Party title="FROM" party={d.seller} />
          <Party title="BILLED TO" party={d.buyer} extra={d.buyer.billingEmail && d.buyer.billingEmail !== d.buyer.email ? d.buyer.billingEmail : null} />
        </View>

        <View style={styles.table}>
          <View style={styles.head}>
            <Text style={styles.cDesc}>Description</Text>
            <Text style={styles.cAmt}>Amount</Text>
          </View>
          <View style={styles.tr}>
            <View style={styles.cDesc}>
              <Text>{d.description}</Text>
              {d.quotationRef ? <Text style={styles.sub}>As per quotation #{d.quotationRef}</Text> : null}
            </View>
            <Text style={styles.cAmt}>{rs(d.amounts.taxable)}</Text>
          </View>
        </View>

        <View style={styles.totals}>
          <View style={styles.tot}>
            <Text style={styles.totLabel}>Value before tax</Text>
            <Text>{rs(d.amounts.taxable)}</Text>
          </View>
          {d.amounts.gstRate ? (
            <View style={styles.tot}>
              <Text style={styles.totLabel}>GST @ {d.amounts.gstRate}%</Text>
              <Text>{rs(d.amounts.gst)}</Text>
            </View>
          ) : null}
          <View style={styles.grand}>
            <Text>Total paid</Text>
            <Text>{rs(d.amounts.total)}</Text>
          </View>
        </View>
        <Text style={styles.paid}>PAID</Text>

        <View style={styles.box}>
          <Text style={styles.boxTitle}>PAYMENT</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Type</Text>
            <Text style={styles.value}>{d.payment.typeLabel}</Text>
          </View>
          {d.payment.paidAt ? (
            <View style={styles.row}>
              <Text style={styles.label}>Paid on</Text>
              <Text style={styles.value}>{day(d.payment.paidAt)}</Text>
            </View>
          ) : null}
          {d.payment.method ? (
            <View style={styles.row}>
              <Text style={styles.label}>Method</Text>
              <Text style={styles.value}>{d.payment.method.replace(/_/g, " ")}</Text>
            </View>
          ) : null}
          {d.payment.reference ? (
            <View style={styles.row}>
              <Text style={styles.label}>Reference</Text>
              <Text style={styles.value}>{d.payment.reference}</Text>
            </View>
          ) : null}
          {d.progress ? (
            <>
              <View style={styles.row}>
                <Text style={styles.label}>Quotation total</Text>
                <Text style={styles.value}>{rs(d.progress.quotationTotal)}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Paid so far</Text>
                <Text style={styles.value}>{rs(d.progress.paidToDate)}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Still to pay</Text>
                <Text style={styles.value}>{rs(d.progress.remaining)}</Text>
              </View>
            </>
          ) : null}
        </View>

        <Text style={styles.footer} fixed>
          Prices include GST. This invoice was produced by the system and needs no signature. Questions about it: {d.seller.email}.
        </Text>
      </Page>
    </Document>
  );
}

export async function generateInvoicePdf(d: InvoiceData): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument d={d} />);
}
