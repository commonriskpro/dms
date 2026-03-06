"use client";

import React, { useCallback, useEffect, useState } from "react";
import type { Session } from "@/auth/auth-service";
import {
  getStoredSession,
  refreshSessionIfNeeded,
  signInWithEmail,
  signOut as authSignOut,
} from "@/auth/auth-service";
import type { QueryClient } from "@tanstack/react-query";

export type AuthState =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "authenticated"; session: Session };

type AuthContextValue = {
  state: AuthState;
  signIn: (email: string, password: string) => Promise<Session>;
  signOut: () => Promise<void>;
  refresh: () => Promise<Session | null>;
  restore: () => Promise<void>;
  isAuthenticated: boolean;
  session: Session | null;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({
  children,
  queryClient,
}: {
  children: React.ReactNode;
  queryClient?: QueryClient;
}) {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  const restore = useCallback(async () => {
    setState({ status: "loading" });
    try {
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
    } catch {
      setState({ status: "unauthenticated" });
    }
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
    try {
      queryClient?.clear();
    } catch {
      // ignore clear errors
    }
    setState({ status: "unauthenticated" });
  }, [queryClient]);

  const refresh = useCallback(async () => {
    const session = await refreshSessionIfNeeded();
    if (session) setState({ status: "authenticated", session });
    return session;
  }, []);

  const value: AuthContextValue = {
    state,
    signIn,
    signOut,
    refresh,
    restore,
    isAuthenticated: state.status === "authenticated",
    session: state.status === "authenticated" ? state.session : null,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (ctx == null) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
