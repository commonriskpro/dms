import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import type { DealItem } from "@/api/endpoints";
import { formatCentsToDisplay } from "../utils";

const styles = StyleSheet.create({
  wrap: { marginBottom: 24 },
  title: { fontSize: 14, fontWeight: "600", color: "#333", marginBottom: 12, textTransform: "uppercase" },
  empty: { padding: 20, alignItems: "center" },
  emptyText: { fontSize: 14, color: "#666" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#eee",
  },
  vehicle: { fontSize: 16, fontWeight: "600" },
  meta: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  badge: { fontSize: 12, color: "#666", textTransform: "uppercase" },
  amount: { fontSize: 14, color: "#333" },
});

function vehicleTitle(d: DealItem): string {
  const v = (d as { vehicle?: { year?: number; make?: string; model?: string; stockNumber?: string } }).vehicle;
  if (!v) return d.vehicleId?.slice(0, 8) ?? "Deal";
  const parts = [v.year, v.make, v.model].filter(Boolean);
  return parts.length ? parts.join(" ") : (v.stockNumber ?? "Vehicle");
}

export function CustomerDealsSection({
  deals,
  isLoading,
  onDealPress,
}: {
  deals: DealItem[];
  isLoading?: boolean;
  onDealPress: (dealId: string) => void;
}) {
  if (isLoading) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>Deals</Text>
        <View style={styles.empty}>
          <ActivityIndicator size="small" />
        </View>
      </View>
    );
  }
  if (!deals.length) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>Deals</Text>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No deals linked</Text>
        </View>
      </View>
    );
  }
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Deals</Text>
      {deals.map((deal) => (
        <TouchableOpacity
          key={deal.id}
          style={styles.card}
          onPress={() => onDealPress(deal.id)}
          activeOpacity={0.7}
        >
          <Text style={styles.vehicle}>{vehicleTitle(deal)}</Text>
          <View style={styles.meta}>
            <Text style={styles.badge}>{deal.status}</Text>
            {deal.totalDueCents != null && (
              <Text style={styles.amount}>{formatCentsToDisplay(deal.totalDueCents)}</Text>
            )}
            {deal.updatedAt != null && (
              <Text style={styles.badge}>{new Date(deal.updatedAt).toLocaleDateString()}</Text>
            )}
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}
