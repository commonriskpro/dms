import { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api, type InventoryItem } from "@/api/endpoints";

function InventoryRow({ item, onPress }: { item: InventoryItem; onPress: () => void }) {
  const subtitle = [item.year, item.make, item.model].filter(Boolean).join(" ") || item.stockNumber;
  const price = item.salePriceCents
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
        Number(item.salePriceCents) / 100
      )
    : null;
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.rowMain}>
        <Text style={styles.rowTitle}>{item.stockNumber}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
        {price != null && <Text style={styles.rowPrice}>{price}</Text>}
      </View>
      <Text style={styles.rowStatus}>{item.status}</Text>
    </TouchableOpacity>
  );
}

export default function InventoryListScreen() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["inventory", { search: search || undefined, limit: 50, offset: 0 }],
    queryFn: () => api.listInventory({ limit: 50, offset: 0, search: search || undefined }),
  });

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
      <View style={styles.headerRow}>
        <TextInput
          style={styles.search}
          placeholder="Search inventory…"
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push("/(tabs)/inventory/add")}
        >
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>
      {isLoading && !data ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
        </View>
      ) : list.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.empty}>No vehicles found</Text>
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <InventoryRow
              item={item}
              onPress={() => router.push(`/(tabs)/inventory/${item.id}`)}
            />
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, gap: 10 },
  search: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  addButton: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    backgroundColor: "#208AEF",
    borderRadius: 8,
  },
  addButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  listContent: { paddingBottom: 24 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    backgroundColor: "#fff",
  },
  rowMain: { flex: 1 },
  rowTitle: { fontSize: 16, fontWeight: "600" },
  rowSubtitle: { fontSize: 14, color: "#666", marginTop: 2 },
  rowPrice: { fontSize: 13, color: "#333", marginTop: 2 },
  rowStatus: { fontSize: 12, color: "#666", textTransform: "uppercase" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  error: { color: "#c00", fontSize: 14, textAlign: "center" },
  empty: { color: "#666", fontSize: 16 },
  retryButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: "#208AEF",
    borderRadius: 8,
  },
  retryText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
