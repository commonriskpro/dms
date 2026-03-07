import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/endpoints";
import { CustomerHeaderCard } from "@/features/customers/components/CustomerHeaderCard";
import { CustomerOverviewCard } from "@/features/customers/components/CustomerOverviewCard";
import { CustomerNotesSection } from "@/features/customers/components/CustomerNotesSection";
import { CustomerActivitySection } from "@/features/customers/components/CustomerActivitySection";
import { CustomerDealsSection } from "@/features/customers/components/CustomerDealsSection";
import { CustomerCommunicationSection } from "@/features/customers/components/CustomerCommunicationSection";

function safeId(param: string | string[] | undefined): string | undefined {
  if (param == null) return undefined;
  return Array.isArray(param) ? param[0] : param;
}

export default function CustomerDetailScreen() {
  const router = useRouter();
  const raw = useLocalSearchParams<{ id: string }>();
  const id = safeId(raw.id);
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["customers", id],
    queryFn: () => api.getCustomerById(id!),
    enabled: Boolean(id),
  });

  const { data: notesData, isLoading: notesLoading } = useQuery({
    queryKey: ["customers", id, "notes"],
    queryFn: () => api.listCustomerNotes(id!, { limit: 25, offset: 0 }),
    enabled: Boolean(id),
  });

  const { data: timelineData, isLoading: timelineLoading } = useQuery({
    queryKey: ["customers", id, "timeline"],
    queryFn: () => api.listCustomerTimeline(id!, { limit: 25, offset: 0 }),
    enabled: Boolean(id),
  });

  const { data: dealsData, isLoading: dealsLoading } = useQuery({
    queryKey: ["deals", { customerId: id }],
    queryFn: () => api.listDeals({ customerId: id!, limit: 25, offset: 0 }),
    enabled: Boolean(id),
  });

  const createNoteMutation = useMutation({
    mutationFn: (body: string) => api.createCustomerNote(id!, { body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers", id] });
      queryClient.invalidateQueries({ queryKey: ["customers", id, "notes"] });
      queryClient.invalidateQueries({ queryKey: ["customers", id, "timeline"] });
    },
  });

  const logCallMutation = useMutation({
    mutationFn: () => api.logCustomerCall(id!, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers", id] });
      queryClient.invalidateQueries({ queryKey: ["customers", id, "timeline"] });
    },
  });

  if (!id) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Invalid customer</Text>
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

  const customer = data?.data;
  if (!customer) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Customer not found</Text>
      </View>
    );
  }

  const notes = notesData?.data ?? [];
  const timelineEvents = timelineData?.data ?? [];
  const deals = dealsData?.data ?? [];
  const hasActivity = timelineEvents.length > 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <CustomerHeaderCard
        customer={customer}
        onEdit={() => router.push(`/(tabs)/customers/edit/${id}`)}
      />
      <CustomerOverviewCard customer={customer} />
      <CustomerNotesSection
        notes={notes}
        isLoading={notesLoading}
        onAddNote={(body) => createNoteMutation.mutateAsync(body)}
        addNotePending={createNoteMutation.isPending}
      />
      <CustomerActivitySection events={timelineEvents} isLoading={timelineLoading} />
      <CustomerDealsSection
        deals={deals}
        isLoading={dealsLoading}
        onDealPress={(dealId) => router.push(`/(tabs)/deals/${dealId}`)}
      />
      <CustomerCommunicationSection
        customer={customer}
        hasActivity={hasActivity}
        onLogCall={() => logCallMutation.mutate()}
        logCallPending={logCallMutation.isPending}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  muted: { color: "#666", fontSize: 14 },
  error: { color: "#c00", fontSize: 14 },
  retryButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: "#208AEF",
    borderRadius: 8,
  },
  retryText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
