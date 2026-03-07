import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import type { DealHistoryEntry } from "../types";
import { DEAL_STATUS_LABELS } from "../types";

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 12, color: "#666", textTransform: "uppercase", marginBottom: 10 },
  row: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#eee" },
  rowLast: { borderBottomWidth: 0 },
  text: { fontSize: 14, color: "#333" },
  date: { fontSize: 12, color: "#666", marginTop: 2 },
  empty: { fontSize: 14, color: "#999", fontStyle: "italic" },
});

function formatEntry(e: DealHistoryEntry): string {
  const toLabel = DEAL_STATUS_LABELS[e.toStatus] ?? e.toStatus;
  if (e.fromStatus == null) return `Created → ${toLabel}`;
  const fromLabel = DEAL_STATUS_LABELS[e.fromStatus] ?? e.fromStatus;
  return `${fromLabel} → ${toLabel}`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function DealActivityCard({
  entries,
  isLoading,
}: {
  entries: DealHistoryEntry[];
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.sectionTitle}>Activity</Text>
        <ActivityIndicator size="small" />
      </View>
    );
  }
  if (!entries.length) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.sectionTitle}>Activity</Text>
        <Text style={styles.empty}>No activity yet</Text>
      </View>
    );
  }
  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionTitle}>Activity</Text>
      {entries.map((e, i) => (
        <View key={e.id} style={[styles.row, i === entries.length - 1 && styles.rowLast]}>
          <Text style={styles.text}>{formatEntry(e)}</Text>
          <Text style={styles.date}>{formatDate(e.createdAt)}</Text>
        </View>
      ))}
    </View>
  );
}
