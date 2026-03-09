import { View, Text, StyleSheet, TouchableOpacity, Linking } from "react-native";
import type { CustomerDetail } from "@/api/endpoints";
import { getPrimaryPhone, getPrimaryEmail } from "../utils";

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  name: { fontSize: 20, fontWeight: "700", color: "#111", marginBottom: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  chip: { fontSize: 12, color: "#666", backgroundColor: "#f0f0f0", paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  actionBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: "#f0f0f0" },
  actionBtnPrimary: { backgroundColor: "#208AEF" },
  actionText: { fontSize: 15, fontWeight: "600", color: "#333" },
  actionTextPrimary: { color: "#fff" },
});

export function CustomerHeaderCard({
  customer,
  onEdit,
}: {
  customer: CustomerDetail;
  onEdit: () => void;
}) {
  const phone = getPrimaryPhone(customer);
  const email = getPrimaryEmail(customer);

  const onCall = () => phone && Linking.openURL(`tel:${phone.replace(/\D/g, "")}`);
  const onSms = () => phone && Linking.openURL(`sms:${phone.replace(/\D/g, "")}`);
  const onMail = () => email && Linking.openURL(`mailto:${email}`);

  return (
    <View style={styles.wrap}>
      <Text style={styles.name}>{customer.name || "—"}</Text>
      <View style={styles.chips}>
        {phone != null && <Text style={styles.chip}>{phone}</Text>}
        {email != null && <Text style={styles.chip}>{email}</Text>}
        {customer.leadSource != null && customer.leadSource !== "" && (
          <Text style={styles.chip}>{customer.leadSource}</Text>
        )}
        <Text style={styles.chip}>{customer.status ?? "—"}</Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={[styles.actionBtn, styles.actionBtnPrimary]} onPress={onEdit}>
          <Text style={[styles.actionText, styles.actionTextPrimary]}>Edit</Text>
        </TouchableOpacity>
        {phone != null && (
          <>
            <TouchableOpacity style={styles.actionBtn} onPress={onCall}>
              <Text style={styles.actionText}>Call</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={onSms}>
              <Text style={styles.actionText}>Text</Text>
            </TouchableOpacity>
          </>
        )}
        {email != null && (
          <TouchableOpacity style={styles.actionBtn} onPress={onMail}>
            <Text style={styles.actionText}>Email</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
