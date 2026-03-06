import { View, Text, StyleSheet, TouchableOpacity, Linking } from "react-native";
import type { CustomerDetail } from "@/api/endpoints";
import { getPrimaryPhone, getPrimaryEmail } from "../utils";

const styles = StyleSheet.create({
  wrap: { marginBottom: 24 },
  title: { fontSize: 14, fontWeight: "600", color: "#333", marginBottom: 12, textTransform: "uppercase" },
  empty: { padding: 20, alignItems: "center" },
  emptyText: { fontSize: 14, color: "#666", textAlign: "center" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
    minWidth: 120,
    alignItems: "center",
  },
  buttonPrimary: { backgroundColor: "#208AEF" },
  buttonText: { fontSize: 16, fontWeight: "600", color: "#333" },
  buttonTextPrimary: { color: "#fff" },
});

export function CustomerCommunicationSection({
  customer,
  hasActivity,
}: {
  customer: CustomerDetail;
  hasActivity: boolean;
}) {
  const phone = getPrimaryPhone(customer);
  const email = getPrimaryEmail(customer);

  const handleCall = () => {
    if (phone) Linking.openURL(`tel:${phone.replace(/\D/g, "")}`);
  };
  const handleSms = () => {
    if (phone) Linking.openURL(`sms:${phone.replace(/\D/g, "")}`);
  };
  const handleEmail = () => {
    if (email) Linking.openURL(`mailto:${email}`);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Communication</Text>
      {!hasActivity && !phone && !email ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No contact info or history. Add phone/email to call or email.</Text>
        </View>
      ) : (
        <>
          {(!hasActivity && (phone || email)) && (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Calls and messages appear in Activity above.</Text>
            </View>
          )}
          <View style={styles.actions}>
            {phone != null && (
              <>
                <TouchableOpacity style={[styles.button, styles.buttonPrimary]} onPress={handleCall}>
                  <Text style={[styles.buttonText, styles.buttonTextPrimary]}>Call</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.button} onPress={handleSms}>
                  <Text style={styles.buttonText}>Text</Text>
                </TouchableOpacity>
              </>
            )}
            {email != null && (
              <TouchableOpacity style={styles.button} onPress={handleEmail}>
                <Text style={styles.buttonText}>Email</Text>
              </TouchableOpacity>
            )}
          </View>
        </>
      )}
    </View>
  );
}
