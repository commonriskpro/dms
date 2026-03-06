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
import { useQuery } from "@tanstack/react-query";
import { api, type DealItem } from "@/api/endpoints";

function DealRow({ item, onPress }: { item: DealItem; onPress: () => void }) {
  const amount = item.totalDueCents ? `$${(Number(item.totalDueCents) / 100).toFixed(0)}` : "—";
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.rowMain}>
        <Text style={styles.rowTitle}>Deal #{item.id.slice(0, 8)}</Text>
        <Text style={styles.rowSubtitle}>{amount} · {item.status}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function DealsListScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["deals", { limit: 50, offset: 0 }],
    queryFn: () => api.listDeals({ limit: 50, offset: 0 }),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error instanceof Error ? error.message : "Failed to load"}</Text>
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
      ) : list.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.empty}>No deals found</Text>
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <DealRow
              item={item}
              onPress={() => router.push(`/(tabs)/deals/${item.id}`)}
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
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  error: { color: "#c00", fontSize: 14 },
  empty: { color: "#666", fontSize: 16 },
});
