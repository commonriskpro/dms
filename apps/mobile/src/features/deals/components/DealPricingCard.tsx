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
});

export function DealPricingCard({ deal }: { deal: DealDetail }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionTitle}>Pricing</Text>
      <View style={styles.row}>
        <Text style={styles.label}>Sale price</Text>
        <Text style={styles.value}>{formatCents(deal.salePriceCents)}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Tax</Text>
        <Text style={styles.value}>{formatCents(deal.taxCents)}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Doc fee</Text>
        <Text style={styles.value}>{formatCents(deal.docFeeCents)}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Total fees</Text>
        <Text style={styles.value}>{formatCents(deal.totalFeesCents)}</Text>
      </View>
      <View style={styles.row}>
        <Text style={[styles.label, { fontWeight: "600" }]}>Total due</Text>
        <Text style={[styles.value, { fontWeight: "700" }]}>{formatCents(deal.totalDueCents)}</Text>
      </View>
    </View>
  );
}
