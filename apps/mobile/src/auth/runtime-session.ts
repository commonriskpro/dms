/**
 * In-memory session store for the API client.
 * AuthProvider is the only writer; API client reads here first so the first
 * request after login uses the fresh token without waiting for SecureStore/refresh.
 */
import type { Session } from "@/auth/auth-service";

let currentSession: Session | null = null;

export function getCurrentSession(): Session | null {
  return currentSession;
}

export function setCurrentSession(session: Session | null): void {
  currentSession = session;
}
