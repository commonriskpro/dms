import { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { requestPasswordReset } from "@/auth/auth-service";

const RESET_REDIRECT = "dmsdealer://reset-password";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const submitting = useRef(false);

  const handleSubmit = async () => {
    if (submitting.current) return;
    setError(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Enter your email address");
      return;
    }
    submitting.current = true;
    setLoading(true);
    try {
      await requestPasswordReset(trimmed, RESET_REDIRECT);
      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send reset email");
    } finally {
      setLoading(false);
      submitting.current = false;
    }
  };

  if (success) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.subtitle}>
            We sent a password reset link to {email.trim()}. Open the link to set a new password.
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => router.replace("/(auth)/login")}
          >
            <Text style={styles.buttonText}>Back to sign in</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Forgot password?</Text>
        <Text style={styles.subtitle}>
          Enter your email and we'll send a reset link.
        </Text>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={(t) => { setEmail(t); setError(null); }}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          editable={!loading}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Send reset link</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => router.back()}
          disabled={loading}
        >
          <Text style={styles.linkText}>Back to sign in</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#f5f5f5",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 24,
  },
  errorBox: {
    backgroundColor: "#fee",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: "#c00",
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    marginBottom: 12,
  },
  button: {
    backgroundColor: "#208AEF",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
    minHeight: 48,
    justifyContent: "center",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  linkButton: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: "center",
  },
  linkText: {
    color: "#208AEF",
    fontSize: 15,
  },
});
