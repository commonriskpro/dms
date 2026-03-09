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
  ScrollView,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "@/auth/use-auth";
import { api } from "@/api/endpoints";
import { DealerApiError } from "@/api/client";
import { setPendingInviteToken, clearPendingInviteToken, getPendingInviteToken } from "@/features/auth/pending-invite";

const MIN_PASSWORD_LENGTH = 12;

type ResolveState = "idle" | "loading" | "success" | "error";

export default function AcceptInviteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const { isAuthenticated } = useAuth();
  const tokenFromParams =
    (params?.token ?? "").trim() || (getPendingInviteToken() ?? "");

  const [token, setToken] = useState(tokenFromParams);
  const [tokenInput, setTokenInput] = useState(tokenFromParams);
  const [resolveState, setResolveState] = useState<ResolveState>(tokenFromParams ? "loading" : "idle");
  const [resolveData, setResolveData] = useState<{
    dealershipName: string;
    roleName: string;
    emailMasked?: string;
  } | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const [mode, setMode] = useState<"choose" | "signup">("choose");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [acceptLoading, setAcceptLoading] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const submitting = useRef(false);

  useEffect(() => {
    if (!token.trim()) {
      setResolveState("idle");
      return;
    }
    let cancelled = false;
    setResolveState("loading");
    setResolveError(null);
    api.inviteResolve(token)
      .then((res) => {
        if (!cancelled) {
          setResolveData({
            dealershipName: res.data.dealershipName,
            roleName: res.data.roleName,
            emailMasked: res.data.emailMasked,
          });
          setResolveState("success");
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const msg = e instanceof DealerApiError ? e.message : "Failed to load invite";
        const code = e instanceof DealerApiError ? e.code : "";
        setResolveError(code === "INVITE_NOT_FOUND" ? "Invite not found." : code === "INVITE_EXPIRED" || code === "INVITE_ALREADY_ACCEPTED" ? "This invite has expired or already been used." : msg);
        setResolveState("error");
      });
    return () => { cancelled = true; };
  }, [token]);

  const handleSignInToAccept = () => {
    setPendingInviteToken(token);
    router.replace("/(auth)/login");
  };

  const handleAcceptAuthenticated = async () => {
    if (submitting.current) return;
    submitting.current = true;
    setAcceptLoading(true);
    setAcceptError(null);
    try {
      await api.inviteAccept(token);
      clearPendingInviteToken();
      router.replace("/(tabs)");
    } catch (e) {
      setAcceptError(e instanceof DealerApiError ? e.message : "Failed to accept invite");
    } finally {
      setAcceptLoading(false);
      submitting.current = false;
    }
  };

  const handleSignupSubmit = async () => {
    if (submitting.current) return;
    setAcceptError(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setAcceptError("Email is required");
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setAcceptError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }
    if (password !== confirmPassword) {
      setAcceptError("Passwords do not match");
      return;
    }
    submitting.current = true;
    setAcceptLoading(true);
    try {
      await api.inviteAcceptSignup({
        token,
        email: trimmedEmail,
        password,
        confirmPassword,
        fullName: fullName.trim() || undefined,
      });
      clearPendingInviteToken();
      router.replace("/(auth)/login");
    } catch (e) {
      const err = e instanceof DealerApiError ? e : null;
      const details = err?.details as { fieldErrors?: Record<string, string> } | undefined;
      const fieldMsg = details?.fieldErrors?.email ?? details?.fieldErrors?.password;
      setAcceptError(fieldMsg ?? (err?.message ?? "Failed to create account"));
    } finally {
      setAcceptLoading(false);
      submitting.current = false;
    }
  };

  if (resolveState === "loading") {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#208AEF" />
        <Text style={styles.muted}>Loading invite…</Text>
      </View>
    );
  }

  if (resolveState === "error") {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Invalid invite</Text>
          <Text style={styles.subtitle}>{resolveError}</Text>
          <TouchableOpacity style={styles.button} onPress={() => router.replace("/(auth)/login")}>
            <Text style={styles.buttonText}>Back to sign in</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (resolveState === "idle" && !token) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Accept invite</Text>
          <Text style={styles.subtitle}>Open an invite link or paste the invite token below.</Text>
          <TextInput
            style={styles.input}
            placeholder="Invite token"
            value={tokenInput}
            onChangeText={setTokenInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity style={styles.button} onPress={() => tokenInput.trim() && setToken(tokenInput.trim())}>
            <Text style={styles.buttonText}>Continue</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkButton} onPress={() => router.replace("/(auth)/login")}>
            <Text style={styles.linkText}>Back to sign in</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (resolveState === "success" && resolveData) {
    if (mode === "signup") {
      return (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.card}>
              <Text style={styles.title}>Create account</Text>
              <Text style={styles.subtitle}>
                Join {resolveData.dealershipName} as {resolveData.roleName}. Enter the email this invite was sent to.
              </Text>
              {acceptError ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{acceptError}</Text>
                </View>
              ) : null}
              <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={(t) => { setEmail(t); setAcceptError(null); }} autoCapitalize="none" keyboardType="email-address" editable={!acceptLoading} />
              <TextInput style={styles.input} placeholder="Password (min 12 characters)" value={password} onChangeText={(t) => { setPassword(t); setAcceptError(null); }} secureTextEntry editable={!acceptLoading} />
              <TextInput style={styles.input} placeholder="Confirm password" value={confirmPassword} onChangeText={(t) => { setConfirmPassword(t); setAcceptError(null); }} secureTextEntry editable={!acceptLoading} />
              <TextInput style={styles.input} placeholder="Full name (optional)" value={fullName} onChangeText={setFullName} editable={!acceptLoading} />
              <TouchableOpacity style={[styles.button, acceptLoading && styles.buttonDisabled]} onPress={handleSignupSubmit} disabled={acceptLoading}>
                {acceptLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create account & accept</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.linkButton} onPress={() => { setMode("choose"); setAcceptError(null); }} disabled={acceptLoading}>
                <Text style={styles.linkText}>Back</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      );
    }

    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>You're invited</Text>
          <Text style={styles.subtitle}>
            {resolveData.dealershipName} — {resolveData.roleName}
            {resolveData.emailMasked ? ` (${resolveData.emailMasked})` : ""}
          </Text>

          {isAuthenticated ? (
            <>
              {acceptError ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{acceptError}</Text>
                </View>
              ) : null}
              <TouchableOpacity style={[styles.button, acceptLoading && styles.buttonDisabled]} onPress={handleAcceptAuthenticated} disabled={acceptLoading}>
                {acceptLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Accept invite</Text>}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity style={styles.button} onPress={handleSignInToAccept}>
                <Text style={styles.buttonText}>Sign in to accept</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => setMode("signup")}>
                <Text style={styles.secondaryButtonText}>Create account to accept</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity style={styles.linkButton} onPress={() => router.replace("/(auth)/login")}>
            <Text style={styles.linkText}>Back to sign in</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#f5f5f5" },
  centered: { alignItems: "center" },
  scrollContent: { paddingVertical: 24 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 4 },
  subtitle: { fontSize: 14, color: "#666", marginBottom: 24 },
  muted: { color: "#666", marginTop: 12 },
  errorBox: { backgroundColor: "#fee", padding: 12, borderRadius: 8, marginBottom: 16 },
  errorText: { color: "#c00", fontSize: 14 },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 14, fontSize: 16, marginBottom: 12 },
  button: { backgroundColor: "#208AEF", padding: 16, borderRadius: 8, alignItems: "center", marginTop: 8, minHeight: 48, justifyContent: "center" },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  secondaryButton: { marginTop: 12, padding: 16, alignItems: "center" },
  secondaryButtonText: { color: "#208AEF", fontSize: 15 },
  linkButton: { marginTop: 16, paddingVertical: 12, alignItems: "center" },
  linkText: { color: "#208AEF", fontSize: 15 },
});
