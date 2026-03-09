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
import { authDebug } from "@/lib/auth-debug";
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
    authDebug("auth-context.restore.start", { runId });

    setState((prev) =>
      prev.status === "authenticated" ? prev : { status: "loading" }
    );

    try {
      const stored = await getStoredSession();

      if (runId !== restoreRunIdRef.current) {
        authDebug("auth-context.restore.stale-after-stored", {
          runId,
          currentRunId: restoreRunIdRef.current,
        });
        return;
      }

      if (stored) {
        setCurrentSession(stored);
        setState({ status: "authenticated", session: stored });
        authDebug("auth-context.restore.result.stored", {
          runId,
          hasAccessToken: Boolean(stored.accessToken),
          expiresAt: stored.expiresAt,
        });
        return;
      }

      const refreshed = await refreshSessionIfNeeded();

      if (runId !== restoreRunIdRef.current) {
        authDebug("auth-context.restore.stale-after-refresh", {
          runId,
          currentRunId: restoreRunIdRef.current,
        });
        return;
      }

      if (refreshed) {
        setCurrentSession(refreshed);
        setState({ status: "authenticated", session: refreshed });
        authDebug("auth-context.restore.result.refreshed", {
          runId,
          hasAccessToken: Boolean(refreshed.accessToken),
          expiresAt: refreshed.expiresAt,
        });
        return;
      }

      setCurrentSession(null);
      setState((prev) =>
        prev.status === "authenticated" ? prev : { status: "unauthenticated" }
      );
      authDebug("auth-context.restore.result.unauthenticated", { runId });
    } catch {
      if (runId !== restoreRunIdRef.current) {
        authDebug("auth-context.restore.stale-after-error", {
          runId,
          currentRunId: restoreRunIdRef.current,
        });
        return;
      }

      setCurrentSession(null);
      setState((prev) =>
        prev.status === "authenticated" ? prev : { status: "unauthenticated" }
      );
      authDebug("auth-context.restore.error", { runId });
    }
  }, []);

  useEffect(() => {
    void restore();
  }, [restore]);

  const signIn = useCallback(async (email: string, password: string) => {
    authDebug("auth-context.signIn.start");
    const session = await signInWithEmail(email, password);

    /**
     * Invalidate any in-flight restore so it cannot clobber this login.
     */
    restoreRunIdRef.current++;
    authDebug("auth-context.signIn.invalidate-restore", {
      currentRunId: restoreRunIdRef.current,
    });

    /**
     * Set runtime session before React state so the first API request
     * (e.g. GET /api/me) sees the token immediately.
     */
    setCurrentSession(session);
    authDebug("auth-context.signIn.runtime-session-set", {
      hasAccessToken: Boolean(session.accessToken),
      expiresAt: session.expiresAt,
    });
    setState({ status: "authenticated", session });
    authDebug("auth-context.signIn.state-authenticated");

    return session;
  }, []);

  const signOut = useCallback(async () => {
    authDebug("auth-context.signOut.start");
    /**
     * Invalidate in-flight restore/refresh flows.
     */
    restoreRunIdRef.current++;
    authDebug("auth-context.signOut.invalidate-restore", {
      currentRunId: restoreRunIdRef.current,
    });

    setCurrentSession(null);
    authDebug("auth-context.signOut.runtime-session-cleared");
    await authSignOut();

    try {
      queryClient?.clear();
      authDebug("auth-context.signOut.query-cache-cleared");
    } catch {
      // ignore query cache clear errors
      authDebug("auth-context.signOut.query-cache-clear-error");
    }

    setState({ status: "unauthenticated" });
    authDebug("auth-context.signOut.state-unauthenticated");
  }, [queryClient]);

  const refresh = useCallback(async () => {
    authDebug("auth-context.refresh.start");
    const session = await refreshSessionIfNeeded();

    if (session) {
      restoreRunIdRef.current++;
      setCurrentSession(session);
      setState({ status: "authenticated", session });
      authDebug("auth-context.refresh.success", {
        hasAccessToken: Boolean(session.accessToken),
        expiresAt: session.expiresAt,
      });
      return session;
    }

    authDebug("auth-context.refresh.no-session");
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