import { View, Text, StyleSheet, TouchableOpacity, Linking, ActivityIndicator } from "react-native";
import type { CustomerDetail } from "@/api/endpoints";
import { getPrimaryPhone, getPrimaryEmail } from "../utils";

const MIN_TOUCH = 48;

const styles = StyleSheet.create({
  wrap: { marginBottom: 24 },
  title: { fontSize: 12, fontWeight: "600", color: "#666", marginBottom: 10, textTransform: "uppercase" },
  empty: { padding: 20, alignItems: "center" },
  emptyText: { fontSize: 14, color: "#666", textAlign: "center", lineHeight: 20 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
    minWidth: 100,
    minHeight: MIN_TOUCH,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPrimary: { backgroundColor: "#208AEF" },
  buttonText: { fontSize: 16, fontWeight: "600", color: "#333" },
  buttonTextPrimary: { color: "#fff" },
  hint: { fontSize: 12, color: "#666", marginTop: 10, lineHeight: 18 },
});

export function CustomerCommunicationSection({
  customer,
  hasActivity,
  onLogCall,
  logCallPending,
}: {
  customer: CustomerDetail;
  hasActivity: boolean;
  onLogCall?: () => void;
  logCallPending?: boolean;
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

  const hasContact = phone != null || email != null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Communication</Text>
      {!hasContact ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            Add a phone or email in Edit to call or email this customer.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.actions}>
            {phone != null && (
              <>
                <TouchableOpacity
                  style={[styles.button, styles.buttonPrimary]}
                  onPress={handleCall}
                  accessibilityRole="button"
                  accessibilityLabel="Call customer"
                >
                  <Text style={[styles.buttonText, styles.buttonTextPrimary]}>Call</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.button}
                  onPress={handleSms}
                  accessibilityRole="button"
                  accessibilityLabel="Text customer"
                >
                  <Text style={styles.buttonText}>Text</Text>
                </TouchableOpacity>
              </>
            )}
            {email != null && (
              <TouchableOpacity
                style={styles.button}
                onPress={handleEmail}
                accessibilityRole="button"
                accessibilityLabel="Email customer"
              >
                <Text style={styles.buttonText}>Email</Text>
              </TouchableOpacity>
            )}
            {phone != null && onLogCall != null && (
              <TouchableOpacity
                style={styles.button}
                onPress={onLogCall}
                disabled={logCallPending}
                accessibilityRole="button"
                accessibilityLabel="Log call to activity"
              >
                {logCallPending ? (
                  <ActivityIndicator size="small" color="#333" />
                ) : (
                  <Text style={styles.buttonText}>Log call</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.hint}>
            Calls you make can be logged to Activity above. Tap &quot;Log call&quot; after a call to record it.
          </Text>
        </>
      )}
    </View>
  );
}
