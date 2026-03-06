"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@/auth/auth-service";
import {
  getStoredSession,
  refreshSessionIfNeeded,
  signInWithEmail,
  signOut as authSignOut,
} from "@/auth/auth-service";
import { setCurrentSession } from "@/auth/runtime-session";
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

  /**
   * Guards async restore runs so an older bootstrap cannot overwrite
   * a newer successful login.
   */
  const restoreRunIdRef = useRef(0);

  const restore = useCallback(async () => {
    const runId = ++restoreRunIdRef.current;

    setState((prev) =>
      prev.status === "authenticated" ? prev : { status: "loading" }
    );

    try {
      const stored = await getStoredSession();

      if (runId !== restoreRunIdRef.current) return;

      if (stored) {
        setCurrentSession(stored);
        setState({ status: "authenticated", session: stored });
        return;
      }

      const refreshed = await refreshSessionIfNeeded();

      if (runId !== restoreRunIdRef.current) return;

      if (refreshed) {
        setCurrentSession(refreshed);
        setState({ status: "authenticated", session: refreshed });
        return;
      }

      setCurrentSession(null);
      setState((prev) =>
        prev.status === "authenticated" ? prev : { status: "unauthenticated" }
      );
    } catch {
      if (runId !== restoreRunIdRef.current) return;

      setCurrentSession(null);
      setState((prev) =>
        prev.status === "authenticated" ? prev : { status: "unauthenticated" }
      );
    }
  }, []);

  useEffect(() => {
    void restore();
  }, [restore]);

  const signIn = useCallback(async (email: string, password: string) => {
    const session = await signInWithEmail(email, password);

    /**
     * Invalidate any in-flight restore so it cannot clobber this login.
     */
    restoreRunIdRef.current++;

    /**
     * Set runtime session before React state so the first API request
     * (e.g. GET /api/me) sees the token immediately.
     */
    setCurrentSession(session);
    setState({ status: "authenticated", session });

    return session;
  }, []);

  const signOut = useCallback(async () => {
    /**
     * Invalidate in-flight restore/refresh flows.
     */
    restoreRunIdRef.current++;

    setCurrentSession(null);
    await authSignOut();

    try {
      queryClient?.clear();
    } catch {
      // ignore query cache clear errors
    }

    setState({ status: "unauthenticated" });
  }, [queryClient]);

  const refresh = useCallback(async () => {
    const session = await refreshSessionIfNeeded();

    if (session) {
      restoreRunIdRef.current++;
      setCurrentSession(session);
      setState({ status: "authenticated", session });
      return session;
    }

    return null;
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