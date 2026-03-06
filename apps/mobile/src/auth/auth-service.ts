import { supabase } from "@/auth/supabase";
import {
  saveSession,
  getStoredAccessToken,
  getStoredRefreshToken,
  getStoredExpiresAt,
  clearSession,
} from "@/auth/session-store";

const BUFFER_SECONDS = 60;

export type AuthUser = { id: string; email: string };
export type Session = { accessToken: string; refreshToken: string; expiresAt: number; user: AuthUser };

function fromSupabaseUser(u: { id: string; email?: string | null }): AuthUser {
  return { id: u.id, email: u.email ?? "" };
}

export async function signInWithEmail(email: string, password: string): Promise<Session> {
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
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token ?? "",
    expiresAt: session.expires_at ?? 0,
    user,
  };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
  await clearSession();
}

export async function getStoredSession(): Promise<Session | null> {
  const [accessToken, refreshToken, expiresAt] = await Promise.all([
    getStoredAccessToken(),
    getStoredRefreshToken(),
    getStoredExpiresAt(),
  ]);
  if (!accessToken || !refreshToken || expiresAt == null) return null;
  const { data: { user }, error } = await supabase.auth.getUser(accessToken);
  if (error || !user) return null;
  return {
    accessToken,
    refreshToken,
    expiresAt,
    user: fromSupabaseUser(user),
  };
}

export async function refreshSessionIfNeeded(): Promise<Session | null> {
  const accessToken = await getStoredAccessToken();
  const refreshToken = await getStoredRefreshToken();
  const expiresAt = await getStoredExpiresAt();
  if (!refreshToken || expiresAt == null) return null;
  const now = Math.floor(Date.now() / 1000);
  if (accessToken && expiresAt > now + BUFFER_SECONDS) {
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (!error && user) {
      return {
        accessToken,
        refreshToken,
        expiresAt,
        user: fromSupabaseUser(user),
      };
    }
  }
  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session) return null;
  const session = data.session;
  await saveSession(
    session.access_token,
    session.refresh_token ?? "",
    session.expires_at ?? 0
  );
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
