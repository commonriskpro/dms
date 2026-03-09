import { View, Text, StyleSheet } from "react-native";
import type { DealDetail } from "../types";

function formatCents(cents: string | undefined): string {
  if (cents == null || cents === "") return "—";
  const n = Number(cents);
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n / 100);
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 12, color: "#666", textTransform: "uppercase", marginBottom: 10 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 },
  label: { fontSize: 14, color: "#444" },
  value: { fontSize: 16, fontWeight: "500" },
  empty: { fontSize: 14, color: "#999", fontStyle: "italic" },
});

export function DealFinanceCard({ deal }: { deal: DealDetail }) {
  const finance = deal.dealFinance;
  const downPaymentCents = deal.downPaymentCents;
  if (!finance) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.sectionTitle}>Finance</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Down payment</Text>
          <Text style={styles.value}>{formatCents(downPaymentCents)}</Text>
        </View>
        <Text style={styles.empty}>No finance terms on file</Text>
      </View>
    );
  }
  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionTitle}>Finance</Text>
      <View style={styles.row}>
        <Text style={styles.label}>Down payment</Text>
        <Text style={styles.value}>{formatCents(deal.downPaymentCents)}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Amount financed</Text>
        <Text style={styles.value}>{formatCents(finance.amountFinancedCents)}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Monthly payment</Text>
        <Text style={styles.value}>{formatCents(finance.monthlyPaymentCents)}</Text>
      </View>
      {finance.termMonths != null && (
        <View style={styles.row}>
          <Text style={styles.label}>Term</Text>
          <Text style={styles.value}>{finance.termMonths} mo</Text>
        </View>
      )}
      {finance.lenderName && (
        <View style={styles.row}>
          <Text style={styles.label}>Lender</Text>
          <Text style={styles.value}>{finance.lenderName}</Text>
        </View>
      )}
    </View>
  );
}
