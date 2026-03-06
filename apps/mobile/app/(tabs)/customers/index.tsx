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
import { api, type CustomerItem } from "@/api/endpoints";

function CustomerRow({ item, onPress }: { item: CustomerItem; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.rowMain}>
        <Text style={styles.rowTitle}>{item.name}</Text>
        <Text style={styles.rowSubtitle}>{item.primaryPhone ?? item.primaryEmail ?? "—"}</Text>
      </View>
      <Text style={styles.rowStatus}>{item.status}</Text>
    </TouchableOpacity>
  );
}

export default function CustomersListScreen() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["customers", { search: search || undefined, limit: 50, offset: 0 }],
    queryFn: () => api.listCustomers({ limit: 50, offset: 0, search: search || undefined }),
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
      <TextInput
        style={styles.search}
        placeholder="Search customers…"
        value={search}
        onChangeText={setSearch}
        returnKeyType="search"
      />
      {isLoading && !data ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
        </View>
      ) : list.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.empty}>No customers found</Text>
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <CustomerRow
              item={item}
              onPress={() => router.push(`/(tabs)/customers/${item.id}`)}
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
  search: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    margin: 16,
    fontSize: 16,
  },
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
  rowStatus: { fontSize: 12, color: "#666", textTransform: "uppercase" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  error: { color: "#c00", fontSize: 14 },
  empty: { color: "#666", fontSize: 16 },
});
