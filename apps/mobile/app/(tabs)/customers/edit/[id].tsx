import { View, Text, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/endpoints";
import { CustomerForm } from "@/features/customers/components/CustomerForm";

function safeId(param: string | string[] | undefined): string | undefined {
  if (param == null) return undefined;
  return Array.isArray(param) ? param[0] : param;
}

export default function EditCustomerScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const raw = useLocalSearchParams<{ id: string }>();
  const id = safeId(raw.id);

  const { data, isLoading, error } = useQuery({
    queryKey: ["customers", id],
    queryFn: () => api.getCustomerById(id!),
    enabled: Boolean(id),
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
        <Text style={styles.muted}>Loading…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error instanceof Error ? error.message : "Something went wrong"}</Text>
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

  const handleSubmit = async (body: Parameters<Parameters<typeof CustomerForm>[0]["onSubmit"]>[0]) => {
    await api.updateCustomer(id, body);
    queryClient.invalidateQueries({ queryKey: ["customers"] });
    queryClient.invalidateQueries({ queryKey: ["customers", id] });
    router.back();
  };

  return (
    <CustomerForm
      mode="edit"
      initialCustomer={customer}
      onSubmit={handleSubmit}
      submitLabel="Save changes"
    />
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  muted: { color: "#666", fontSize: 14 },
  error: { color: "#c00", fontSize: 14 },
});
