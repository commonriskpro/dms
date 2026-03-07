import { useLocalSearchParams, useRouter } from "expo-router";
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import { useDeal, useUpdateDeal } from "@/features/deals/hooks";
import { DealForm } from "@/features/deals/components/DealForm";
import type { UpdateDealBody } from "@/features/deals/types";
import { DealerApiError } from "@/api/errors";

function safeId(param: string | string[] | undefined): string | undefined {
  if (param == null) return undefined;
  return Array.isArray(param) ? param[0] : param;
}

export default function EditDealScreen() {
  const raw = useLocalSearchParams<{ id: string }>();
  const id = safeId(raw.id);
  const router = useRouter();
  const { data, isLoading, error } = useDeal(id);
  const update = useUpdateDeal(id);

  const handleSubmit = (payload: UpdateDealBody) => {
    if (!id) return;
    update.mutate(payload, {
      onSuccess: () => {
        router.replace(`/(tabs)/deals/${id}`);
      },
    });
  };

  const apiError =
    update.isError && update.error instanceof DealerApiError
      ? update.error.message
      : update.isError
        ? "Failed to update deal"
        : null;

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
        <TouchableOpacity style={styles.btn} onPress={() => router.back()}>
          <Text style={styles.btnText}>Back</Text>
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

  return (
    <DealForm
      mode="edit"
      deal={deal}
      onSubmit={handleSubmit}
      isSubmitting={update.isPending}
      apiError={apiError}
    />
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  muted: { color: "#666", fontSize: 14 },
  error: { color: "#c00", fontSize: 14, textAlign: "center" },
  btn: { marginTop: 16, paddingVertical: 12, paddingHorizontal: 24, backgroundColor: "#208AEF", borderRadius: 8 },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
