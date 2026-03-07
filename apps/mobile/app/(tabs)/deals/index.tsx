import { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useDealsList } from "@/features/deals/hooks";
import { DEAL_STATUS_LABELS } from "@/features/deals/types";
import type { DealListItem } from "@/features/deals/types";

function vehicleSummary(v: DealListItem["vehicle"]): string {
  if (!v) return "—";
  const parts = [v.year, v.make, v.model].filter(Boolean);
  return parts.length ? parts.join(" ") : v.stockNumber;
}

function DealRow({ item, onPress }: { item: DealListItem; onPress: () => void }) {
  const amount = item.totalDueCents
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
        Number(item.totalDueCents) / 100
      )
    : "—";
  const statusLabel = DEAL_STATUS_LABELS[item.status as keyof typeof DEAL_STATUS_LABELS] ?? item.status;
  const customerName = item.customer?.name ?? "—";
  const vehicleLine = vehicleSummary(item.vehicle);
  const updated = item.updatedAt
    ? new Date(item.updatedAt).toLocaleDateString(undefined, { dateStyle: "short" })
    : "";
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.rowMain}>
        <Text style={styles.rowTitle} numberOfLines={1}>{customerName}</Text>
        <Text style={styles.rowSubtitle} numberOfLines={1}>{vehicleLine}</Text>
        <View style={styles.rowMeta}>
          <Text style={styles.badge}>{statusLabel}</Text>
          <Text style={styles.amount}>{amount}</Text>
          {updated ? <Text style={styles.updated}>{updated}</Text> : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const MIN_TOUCH = 48;

export default function DealsListScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const { data, isLoading, error, refetch } = useDealsList({ limit: 50, offset: 0 });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error instanceof Error ? error.message : "Something went wrong"}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const list = data?.data ?? [];
  return (
    <View style={styles.container}>
      {isLoading && !data ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <>
          <FlatList
            data={list}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <DealRow item={item} onPress={() => router.push(`/(tabs)/deals/${item.id}`)} />
            )}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.empty}>No deals found</Text>
              </View>
            }
          />
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => router.push("/(tabs)/deals/add")}
            accessibilityRole="button"
          >
            <Text style={styles.addButtonText}>Add deal</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingBottom: 80 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    minHeight: MIN_TOUCH,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    backgroundColor: "#fff",
  },
  rowMain: { flex: 1 },
  rowTitle: { fontSize: 16, fontWeight: "600" },
  rowSubtitle: { fontSize: 14, color: "#666", marginTop: 2 },
  rowMeta: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 6 },
  badge: {
    fontSize: 11,
    fontWeight: "600",
    color: "#208AEF",
    backgroundColor: "#e8f4fd",
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
    overflow: "hidden",
  },
  amount: { fontSize: 14, fontWeight: "500" },
  updated: { fontSize: 12, color: "#999" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  error: { color: "#c00", fontSize: 14, textAlign: "center" },
  empty: { color: "#666", fontSize: 16 },
  emptyWrap: { padding: 24, alignItems: "center" },
  retryButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: "#208AEF",
    borderRadius: 8,
  },
  retryText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  addButton: {
    position: "absolute",
    bottom: 24,
    left: 16,
    right: 16,
    minHeight: MIN_TOUCH,
    backgroundColor: "#208AEF",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  addButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
