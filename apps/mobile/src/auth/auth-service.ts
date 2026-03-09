import { supabase } from "@/auth/supabase";
import {
  saveSession,
  getStoredAccessToken,
  getStoredRefreshToken,
  getStoredExpiresAt,
  clearSession,
} from "@/auth/session-store";
import { authDebug } from "@/lib/auth-debug";

const BUFFER_SECONDS = 60;

export type AuthUser = { id: string; email: string };
export type Session = { accessToken: string; refreshToken: string; expiresAt: number; user: AuthUser };

function fromSupabaseUser(u: { id: string; email?: string | null }): AuthUser {
  return { id: u.id, email: u.email ?? "" };
}

export async function signInWithEmail(email: string, password: string): Promise<Session> {
  authDebug("auth-service.signInWithEmail.start");
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  const session = data.session;
  if (!session) throw new Error("No session returned");
  const user = fromSupabaseUser(session.user);
  await saveSession(
    session.access_token,
    session.refresh_token ?? "",
    session.expires_at ?? 0
  );
  authDebug("auth-service.signInWithEmail.success", {
    hasAccessToken: Boolean(session.access_token),
    hasRefreshToken: Boolean(session.refresh_token),
    expiresAt: session.expires_at ?? 0,
  });
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token ?? "",
    expiresAt: session.expires_at ?? 0,
    user,
  };
}

export async function signOut(): Promise<void> {
  authDebug("auth-service.signOut.start");
  await supabase.auth.signOut();
  await clearSession();
  authDebug("auth-service.signOut.success");
}

export async function getStoredSession(): Promise<Session | null> {
  authDebug("auth-service.getStoredSession.start");
  const [accessToken, refreshToken, expiresAt] = await Promise.all([
    getStoredAccessToken(),
    getStoredRefreshToken(),
    getStoredExpiresAt(),
  ]);
  if (!accessToken || !refreshToken || expiresAt == null) {
    authDebug("auth-service.getStoredSession.empty", {
      hasAccessToken: Boolean(accessToken),
      hasRefreshToken: Boolean(refreshToken),
      hasExpiresAt: expiresAt != null,
    });
    return null;
  }
  const { data: { user }, error } = await supabase.auth.getUser(accessToken);
  if (error || !user) {
    authDebug("auth-service.getStoredSession.invalid", {
      hasError: Boolean(error),
      hasUser: Boolean(user),
    });
    return null;
  }
  authDebug("auth-service.getStoredSession.success", {
    hasAccessToken: true,
    hasRefreshToken: true,
    expiresAt,
  });
  return {
    accessToken,
    refreshToken,
    expiresAt,
    user: fromSupabaseUser(user),
  };
}

export async function refreshSessionIfNeeded(): Promise<Session | null> {
  authDebug("auth-service.refreshSessionIfNeeded.start");
  const accessToken = await getStoredAccessToken();
  const refreshToken = await getStoredRefreshToken();
  const expiresAt = await getStoredExpiresAt();
  if (!refreshToken || expiresAt == null) {
    authDebug("auth-service.refreshSessionIfNeeded.no-refresh-token-or-expiry", {
      hasRefreshToken: Boolean(refreshToken),
      hasExpiresAt: expiresAt != null,
    });
    return null;
  }
  const now = Math.floor(Date.now() / 1000);
  if (accessToken && expiresAt > now + BUFFER_SECONDS) {
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (!error && user) {
      authDebug("auth-service.refreshSessionIfNeeded.use-existing-token", {
        hasAccessToken: true,
        expiresAt,
      });
      return {
        accessToken,
        refreshToken,
        expiresAt,
        user: fromSupabaseUser(user),
      };
    }
  }
  authDebug("auth-service.refreshSessionIfNeeded.refresh-attempt");
  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session) {
    authDebug("auth-service.refreshSessionIfNeeded.refresh-failed", {
      hasError: Boolean(error),
      hasSession: Boolean(data?.session),
    });
    return null;
  }
  const session = data.session;
  await saveSession(
    session.access_token,
    session.refresh_token ?? "",
    session.expires_at ?? 0
  );
  authDebug("auth-service.refreshSessionIfNeeded.refresh-success", {
    hasAccessToken: Boolean(session.access_token),
    hasRefreshToken: Boolean(session.refresh_token),
    expiresAt: session.expires_at ?? 0,
  });
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token ?? "",
    expiresAt: session.expires_at ?? 0,
    user: fromSupabaseUser(session.user),
  };
}

export async function getValidAccessToken(): Promise<string | null> {
  const session = await refreshSessionIfNeeded();
  return session?.accessToken ?? null;
}

/**
 * Request a password reset email. Supabase sends a link that should redirect to redirectTo.
 * Add redirectTo to Supabase Dashboard → Auth → URL configuration.
 */
export async function requestPasswordReset(email: string, redirectTo: string): Promise<void> {
  authDebug("auth-service.requestPasswordReset.start");
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
  if (error) throw new Error(error.message);
  authDebug("auth-service.requestPasswordReset.success");
}

/**
 * Parse recovery tokens from URL hash (e.g. from password reset link).
 * Returns session if hash contains access_token and refresh_token; otherwise null.
 */
function parseRecoveryFromUrl(url: string): { access_token: string; refresh_token: string; expires_at?: number } | null {
  const hashIndex = url.indexOf("#");
  if (hashIndex === -1) return null;
  const hash = url.slice(hashIndex + 1);
  const params = new URLSearchParams(hash);
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  const type = params.get("type");
  if (type !== "recovery" || !access_token || !refresh_token) return null;
  const expires_at = params.get("expires_at");
  return {
    access_token,
    refresh_token,
    expires_at: expires_at != null ? parseInt(expires_at, 10) : undefined,
  };
}

/**
 * Set Supabase session from a recovery URL without persisting to SecureStore.
 * Use for password-reset flow: app opens from link → call this → show reset-password form → updatePassword → signOut.
 * This avoids making the app "authenticated" so AuthGate does not redirect to tabs.
 */
export async function setSupabaseRecoverySessionOnly(url: string): Promise<boolean> {
  authDebug("auth-service.setSupabaseRecoverySessionOnly.start");
  const tokens = parseRecoveryFromUrl(url);
  if (!tokens) {
    authDebug("auth-service.setSupabaseRecoverySessionOnly.no-tokens");
    return false;
  }
  const { error } = await supabase.auth.setSession({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
  });
  if (error) {
    authDebug("auth-service.setSupabaseRecoverySessionOnly.setSession-failed", { message: error.message });
    return false;
  }
  authDebug("auth-service.setSupabaseRecoverySessionOnly.success");
  return true;
}

/**
 * Update the current user's password. Requires an active session (e.g. recovery session from reset link).
 */
export async function updatePassword(newPassword: string): Promise<void> {
  authDebug("auth-service.updatePassword.start");
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
  authDebug("auth-service.updatePassword.success");
}
