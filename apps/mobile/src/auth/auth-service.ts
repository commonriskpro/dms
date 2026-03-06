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
