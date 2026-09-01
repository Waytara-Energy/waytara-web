import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

export interface PricingLineItem {
  description: string;
  qty: number;
  unit_price: number;
  amount: number;
}

export interface QuotationPdfData {
  quotationId: string;
  createdAt: string;
  leadName: string;
  leadEmail: string;
  leadPhone: string | null;
  planName: string;
  planPrice: number;
  pricingBreakdown: PricingLineItem[];
  subtotalAmount: number;
  gstRate: number;
  gstAmount: number;
  totalAmount: number;
  currency: string;
  validUntil: string | null;
  paymentOption: "full" | "split" | null;
  advanceAmount: number | null;
  balanceAmount: number | null;
}

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#0F172A" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  brand: { fontSize: 18, fontWeight: 700, color: "#16A34A" },
  meta: { textAlign: "right", color: "#475569" },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 11, fontWeight: 700, marginBottom: 6, color: "#0F172A" },
  row: { flexDirection: "row" },
  label: { color: "#64748B", width: 90 },
  value: { flex: 1 },
  table: { marginTop: 8, borderTop: "1 solid #E2E8F0" },
  tableRow: { flexDirection: "row", borderBottom: "1 solid #E2E8F0", paddingVertical: 6 },
  tableHeaderRow: {
    flexDirection: "row",
    paddingVertical: 6,
    backgroundColor: "#F8FAFC",
    fontWeight: 700,
  },
  colDesc: { flex: 3 },
  colQty: { flex: 1, textAlign: "right" },
  colUnit: { flex: 1.5, textAlign: "right" },
  colAmount: { flex: 1.5, textAlign: "right" },
  summaryBlock: { marginTop: 10, alignSelf: "flex-end", width: 220 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  summaryLabel: { color: "#64748B" },
  summaryValue: { color: "#0F172A" },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTop: "1 solid #E2E8F0",
    marginTop: 4,
    paddingTop: 6,
  },
  grandTotalLabel: { fontWeight: 700 },
  grandTotalValue: { fontWeight: 700 },
  footer: { position: "absolute", bottom: 30, left: 40, right: 40, fontSize: 8, color: "#94A3B8" },
});

function formatCurrency(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function QuotationDocument({ data }: { data: QuotationPdfData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>WayTara Energy</Text>
          <View style={styles.meta}>
            <Text>Quotation #{data.quotationId.slice(0, 8)}</Text>
            <Text>{new Date(data.createdAt).toLocaleDateString("en-IN")}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Prepared for</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Name</Text>
            <Text style={styles.value}>{data.leadName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{data.leadEmail}</Text>
          </View>
          {data.leadPhone && (
            <View style={styles.row}>
              <Text style={styles.label}>Phone</Text>
              <Text style={styles.value}>{data.leadPhone}</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.label}>Monitoring plan</Text>
            <Text style={styles.value}>{data.planName}</Text>
          </View>
          {data.validUntil && (
            <View style={styles.row}>
              <Text style={styles.label}>Valid until</Text>
              <Text style={styles.value}>
                {new Date(data.validUntil).toLocaleDateString("en-IN")}
              </Text>
            </View>
          )}
          {data.paymentOption && (
            <View style={styles.row}>
              <Text style={styles.label}>Payment plan</Text>
              <Text style={styles.value}>
                {data.paymentOption === "full"
                  ? "Full payment"
                  : `30% advance (${formatCurrency(data.advanceAmount ?? 0, data.currency)}), balance at installation (${formatCurrency(data.balanceAmount ?? 0, data.currency)})`}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pricing</Text>
          <View style={styles.table}>
            <View style={styles.tableHeaderRow}>
              <Text style={styles.colDesc}>Description</Text>
              <Text style={styles.colQty}>Qty</Text>
              <Text style={styles.colUnit}>Unit Price</Text>
              <Text style={styles.colAmount}>Amount</Text>
            </View>
            {data.pricingBreakdown.map((item, i) => (
              <View style={styles.tableRow} key={i}>
                <Text style={styles.colDesc}>{item.description}</Text>
                <Text style={styles.colQty}>{item.qty}</Text>
                <Text style={styles.colUnit}>{formatCurrency(item.unit_price, data.currency)}</Text>
                <Text style={styles.colAmount}>{formatCurrency(item.amount, data.currency)}</Text>
              </View>
            ))}
            <View style={styles.tableRow}>
              <Text style={styles.colDesc}>Software plan — {data.planName} (one-time)</Text>
              <Text style={styles.colQty}>1</Text>
              <Text style={styles.colUnit}>{formatCurrency(data.planPrice, data.currency)}</Text>
              <Text style={styles.colAmount}>{formatCurrency(data.planPrice, data.currency)}</Text>
            </View>
          </View>

          <View style={styles.summaryBlock}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>{formatCurrency(data.subtotalAmount, data.currency)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>GST ({data.gstRate}%)</Text>
              <Text style={styles.summaryValue}>{formatCurrency(data.gstAmount, data.currency)}</Text>
            </View>
            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>Grand Total</Text>
              <Text style={styles.grandTotalValue}>{formatCurrency(data.totalAmount, data.currency)}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.footer}>
          WayTara Energy Systems · This quotation is an estimate and subject to a final site
          assessment. Contact your WayTara advisor with any questions.
        </Text>
      </Page>
    </Document>
  );
}

export async function generateQuotationPdf(data: QuotationPdfData): Promise<Buffer> {
  return renderToBuffer(<QuotationDocument data={data} />);
}
