import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { setSupabaseRecoverySessionOnly, updatePassword } from "@/auth/auth-service";
import { useAuth } from "@/auth/use-auth";

const MIN_PASSWORD_LENGTH = 12;

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoveryReady, setRecoveryReady] = useState<boolean | null>(null);
  const submitting = useRef(false);

  useEffect(() => {
    let cancelled = false;
    Linking.getInitialURL().then((url) => {
      if (cancelled) return;
      if (url && url.includes("reset-password") && url.includes("#")) {
        setSupabaseRecoverySessionOnly(url).then((ok) => {
          if (!cancelled) setRecoveryReady(ok);
        });
      } else {
        setRecoveryReady(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const handleSubmit = async () => {
    if (submitting.current) return;
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    submitting.current = true;
    setLoading(true);
    try {
      await updatePassword(password);
      await signOut();
      router.replace("/(auth)/login");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update password");
    } finally {
      setLoading(false);
      submitting.current = false;
    }
  };

  if (recoveryReady === null) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#208AEF" />
        <Text style={styles.muted}>Loading…</Text>
      </View>
    );
  }

  if (recoveryReady === false) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.title}>Invalid or expired link</Text>
        <Text style={styles.subtitle}>
          Open the password reset link from your email, or request a new one.
        </Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.replace("/(auth)/forgot-password")}
        >
          <Text style={styles.buttonText}>Request new link</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => router.replace("/(auth)/login")}
        >
          <Text style={styles.linkText}>Back to sign in</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Set new password</Text>
        <Text style={styles.subtitle}>
          Enter your new password below.
        </Text>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <TextInput
          style={styles.input}
          placeholder="New password"
          value={password}
          onChangeText={(t) => { setPassword(t); setError(null); }}
          secureTextEntry
          autoComplete="new-password"
          editable={!loading}
        />
        <TextInput
          style={styles.input}
          placeholder="Confirm password"
          value={confirm}
          onChangeText={(t) => { setConfirm(t); setError(null); }}
          secureTextEntry
          autoComplete="new-password"
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
            <Text style={styles.buttonText}>Update password</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => router.replace("/(auth)/login")}
          disabled={loading}
        >
          <Text style={styles.linkText}>Cancel</Text>
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
  centered: {
    alignItems: "center",
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
  muted: {
    color: "#666",
    marginTop: 12,
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
