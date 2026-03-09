import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api, type CustomerItem } from "@/api/endpoints";

const MIN_TOUCH = 48;

const styles = StyleSheet.create({
  label: { fontSize: 12, color: "#666", textTransform: "uppercase", marginBottom: 6 },
  trigger: {
    minHeight: MIN_TOUCH,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  triggerText: { fontSize: 16, color: "#333" },
  triggerPlaceholder: { fontSize: 16, color: "#999" },
  modal: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: "80%", paddingBottom: 24 },
  search: {
    margin: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
    fontSize: 16,
  },
  list: { paddingHorizontal: 16 },
  row: {
    minHeight: MIN_TOUCH,
    paddingVertical: 12,
    paddingHorizontal: 12,
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  rowTitle: { fontSize: 16, fontWeight: "500" },
  rowSub: { fontSize: 14, color: "#666", marginTop: 2 },
  close: { margin: 16, minHeight: MIN_TOUCH, justifyContent: "center", alignItems: "center", backgroundColor: "#eee", borderRadius: 8 },
  closeText: { fontSize: 16, fontWeight: "600" },
});

export function CustomerPickerField({
  label = "Customer",
  customerId,
  customerName,
  onSelect,
}: {
  label?: string;
  customerId: string | null;
  customerName: string | null;
  onSelect: (id: string, name: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["customers", { search: search || undefined, limit: 50, offset: 0 }],
    queryFn: () => api.listCustomers({ limit: 50, offset: 0, search: search || undefined }),
    enabled: visible,
  });
  const list = data?.data ?? [];

  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.trigger} onPress={() => setVisible(true)} accessibilityRole="button">
        <Text style={customerName ? styles.triggerText : styles.triggerPlaceholder}>
          {customerName ?? "Select customer"}
        </Text>
      </TouchableOpacity>
      <Modal visible={visible} transparent animationType="slide">
        <View style={styles.modal}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setVisible(false)} />
          <View style={styles.sheet}>
            <TextInput
              style={styles.search}
              placeholder="Search customers"
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {isLoading ? (
              <ActivityIndicator style={{ padding: 24 }} />
            ) : (
              <FlatList
                data={list}
                keyExtractor={(item) => item.id}
                style={styles.list}
                renderItem={({ item }: { item: CustomerItem }) => (
                  <TouchableOpacity
                    style={styles.row}
                    onPress={() => {
                      onSelect(item.id, item.name);
                      setVisible(false);
                    }}
                  >
                    <Text style={styles.rowTitle}>{item.name}</Text>
                    <Text style={styles.rowSub}>{item.primaryPhone ?? item.primaryEmail ?? "—"}</Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={<Text style={{ padding: 16, color: "#666" }}>No customers found</Text>}
              />
            )}
            <TouchableOpacity style={styles.close} onPress={() => setVisible(false)}>
              <Text style={styles.closeText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}
