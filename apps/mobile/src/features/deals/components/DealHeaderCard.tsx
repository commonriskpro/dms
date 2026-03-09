import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import type { DealDetail } from "../types";
import { DEAL_STATUS_LABELS } from "../types";

const MIN_TOUCH = 44;

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 },
  title: { fontSize: 18, fontWeight: "700", color: "#111" },
  badge: {
    fontSize: 12,
    fontWeight: "600",
    color: "#fff",
    backgroundColor: "#208AEF",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    overflow: "hidden",
  },
  editBtn: {
    minHeight: MIN_TOUCH,
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
  },
  editText: { fontSize: 15, fontWeight: "600", color: "#208AEF" },
  updated: { fontSize: 12, color: "#666", marginTop: 8 },
});

export function DealHeaderCard({ deal, onEdit }: { deal: DealDetail; onEdit: () => void }) {
  const ref = `Deal #${deal.id.slice(0, 8)}`;
  const statusLabel = DEAL_STATUS_LABELS[deal.status] ?? deal.status;
  const updated = deal.updatedAt ? new Date(deal.updatedAt).toLocaleDateString(undefined, { dateStyle: "medium" }) : "—";
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.title}>{ref}</Text>
        <Text style={styles.badge}>{statusLabel}</Text>
      </View>
      <TouchableOpacity style={styles.editBtn} onPress={onEdit} accessibilityRole="button">
        <Text style={styles.editText}>Edit deal</Text>
      </TouchableOpacity>
      <Text style={styles.updated}>Updated {updated}</Text>
    </View>
  );
}
