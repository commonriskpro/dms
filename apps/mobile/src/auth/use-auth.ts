import { useCallback, useEffect, useState } from "react";
import type { Session } from "@/auth/auth-service";
import {
  getStoredSession,
  refreshSessionIfNeeded,
  signInWithEmail,
  signOut as authSignOut,
} from "@/auth/auth-service";

export type AuthState =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "authenticated"; session: Session };

export function useAuth() {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  const restore = useCallback(async () => {
    const session = await getStoredSession();
    if (session) {
      setState({ status: "authenticated", session });
      return;
    }
    const refreshed = await refreshSessionIfNeeded();
    if (refreshed) {
      setState({ status: "authenticated", session: refreshed });
      return;
    }
    setState({ status: "unauthenticated" });
  }, []);

  useEffect(() => {
    restore();
  }, [restore]);

  const signIn = useCallback(async (email: string, password: string) => {
    const session = await signInWithEmail(email, password);
    setState({ status: "authenticated", session });
    return session;
  }, []);

  const signOut = useCallback(async () => {
    await authSignOut();
    setState({ status: "unauthenticated" });
  }, []);

  const refresh = useCallback(async () => {
    const session = await refreshSessionIfNeeded();
    if (session) setState({ status: "authenticated", session });
    return session;
  }, []);

  return {
    state,
    signIn,
    signOut,
    refresh,
    restore,
    isAuthenticated: state.status === "authenticated",
    session: state.status === "authenticated" ? state.session : null,
  };
}
