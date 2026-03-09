import { View, Text, StyleSheet } from "react-native";
import type { DealDetail, DealFee } from "../types";

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
  value: { fontSize: 14, fontWeight: "500" },
  empty: { fontSize: 14, color: "#999", fontStyle: "italic" },
});

export function DealFeesCard({ deal }: { deal: DealDetail }) {
  const fees: DealFee[] = deal.fees ?? [];
  if (fees.length === 0) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.sectionTitle}>Fees</Text>
        <Text style={styles.empty}>No additional fees</Text>
      </View>
    );
  }
  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionTitle}>Fees</Text>
      {fees.map((f) => (
        <View key={f.id} style={styles.row}>
          <Text style={styles.label}>{f.label}{f.taxable ? " (taxable)" : ""}</Text>
          <Text style={styles.value}>{formatCents(f.amountCents)}</Text>
        </View>
      ))}
    </View>
  );
}
