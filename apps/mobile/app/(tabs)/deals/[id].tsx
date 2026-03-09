import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useDeal, useDealHistory, useUpdateDealStatus } from "@/features/deals/hooks";
import type { DealStatus } from "@/features/deals/types";
import {
  DealHeaderCard,
  DealPartiesCard,
  DealPricingCard,
  DealFeesCard,
  DealFinanceCard,
  DealStatusCard,
  DealActivityCard,
} from "@/features/deals/components";

function safeId(param: string | string[] | undefined): string | undefined {
  if (param == null) return undefined;
  return Array.isArray(param) ? param[0] : param;
}

export default function DealDetailScreen() {
  const raw = useLocalSearchParams<{ id: string }>();
  const id = safeId(raw.id);
  const router = useRouter();
  const { data, isLoading, error, refetch } = useDeal(id);
  const { data: historyData } = useDealHistory(id, { limit: 50, offset: 0 });
  const statusMutation = useUpdateDealStatus(id);

  const handleStatusChange = (status: DealStatus) => {
    statusMutation.mutate(
      { status },
      {
        onError: () => {
          // Error surfaced by mutation; could show Alert
        },
      }
    );
  };

  if (!id) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Invalid deal</Text>
      </View>
    );
  }

  if (isLoading && !data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

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

  const deal = data?.data;
  if (!deal) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Deal not found</Text>
      </View>
    );
  }

  const historyEntries = historyData?.data ?? [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <DealHeaderCard deal={deal} onEdit={() => router.push(`/(tabs)/deals/edit/${id}`)} />
      <DealPartiesCard deal={deal} />
      <DealPricingCard deal={deal} />
      <DealFeesCard deal={deal} />
      <DealFinanceCard deal={deal} />
      <DealStatusCard
        deal={deal}
        onStatusChange={handleStatusChange}
        isUpdating={statusMutation.isPending}
      />
      <DealActivityCard entries={historyEntries} isLoading={false} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  muted: { color: "#666", fontSize: 14 },
  error: { color: "#c00", fontSize: 14, textAlign: "center" },
  retryButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: "#208AEF",
    borderRadius: 8,
  },
  retryText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
