import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import type { DealDetail, DealStatus } from "../types";
import { DEAL_STATUS_LABELS } from "../types";

const MIN_TOUCH = 44;

/** Allowed next statuses for mobile: allow moving to STRUCTURED, APPROVED, CONTRACTED, CANCELED from DRAFT; etc. Backend enforces; we show a simple set. */
const ALLOWED_NEXT: Partial<Record<DealStatus, DealStatus[]>> = {
  DRAFT: ["STRUCTURED", "CANCELED"],
  STRUCTURED: ["APPROVED", "DRAFT", "CANCELED"],
  APPROVED: ["CONTRACTED", "STRUCTURED", "CANCELED"],
  CONTRACTED: [],
  CANCELED: [],
};

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 12, color: "#666", textTransform: "uppercase", marginBottom: 10 },
  current: { fontSize: 16, fontWeight: "600", marginBottom: 12 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  btn: {
    minHeight: MIN_TOUCH,
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "#208AEF",
  },
  btnText: { fontSize: 15, fontWeight: "600", color: "#fff" },
  btnCancel: { backgroundColor: "#ccc" },
  btnCancelText: { color: "#333" },
});

export function DealStatusCard({
  deal,
  onStatusChange,
  isUpdating,
}: {
  deal: DealDetail;
  onStatusChange: (status: DealStatus) => void;
  isUpdating: boolean;
}) {
  const currentLabel = DEAL_STATUS_LABELS[deal.status] ?? deal.status;
  const nextStatuses = ALLOWED_NEXT[deal.status] ?? [];
  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionTitle}>Status</Text>
      <Text style={styles.current}>{currentLabel}</Text>
      {isUpdating && <ActivityIndicator size="small" style={{ marginBottom: 8 }} />}
      <View style={styles.actions}>
        {nextStatuses.map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.btn, s === "CANCELED" && styles.btnCancel]}
            onPress={() => onStatusChange(s)}
            disabled={isUpdating}
            accessibilityRole="button"
          >
            <Text style={[styles.btnText, s === "CANCELED" && styles.btnCancelText]}>
              Move to {DEAL_STATUS_LABELS[s]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
