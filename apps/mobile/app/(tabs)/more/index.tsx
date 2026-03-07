import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from "react-native";
import { useAuth } from "@/auth/use-auth";
import Constants from "expo-constants";
import { DealershipSwitcherCard } from "@/features/dealerships/components/DealershipSwitcherCard";

export default function MoreScreen() {
  const { signOut, session } = useAuth();

  const handleSignOut = () => {
    Alert.alert("Sign out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: signOut },
    ]);
  };

  const appVersion = Constants.expoConfig?.version ?? "1.0.0";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <Text style={styles.email}>{session?.user?.email ?? "—"}</Text>
      </View>

      <DealershipSwitcherCard />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Settings</Text>
        <Text style={styles.placeholder}>Settings placeholder — preferences, notifications</Text>
      </View>

      <View style={styles.section}>
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>DMS Dealer Mobile · v{appVersion}</Text>
        <Text style={styles.footerText}>Backend: Dealer API only</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 12,
    color: "#666",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  email: { fontSize: 16, fontWeight: "500" },
  placeholder: { fontSize: 14, color: "#666" },
  signOutButton: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#c00",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  signOutText: { color: "#c00", fontSize: 16, fontWeight: "600" },
  footer: { marginTop: 32, paddingTop: 16, borderTopWidth: 1, borderTopColor: "#eee" },
  footerText: { fontSize: 12, color: "#999", marginBottom: 4 },
});
