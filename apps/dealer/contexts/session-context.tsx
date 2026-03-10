"use client";

import * as React from "react";
import { apiFetch } from "@/lib/client/http";
import type { SessionResponse } from "@/lib/types/session";

type SessionState =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "authenticated"; data: SessionResponse }
  | { status: "error"; message: string };

type SessionContextValue = {
  state: SessionState;
  refetch: () => Promise<void>;
  hasPermission: (key: string) => boolean;
  user: SessionResponse["user"] | null;
  activeDealership: SessionResponse["activeDealership"] | null;
  lifecycleStatus: SessionResponse["lifecycleStatus"] | null;
  lastStatusReason: string | null;
  closedDealership: SessionResponse["closedDealership"] | null;
  permissions: string[];
  pendingApproval: boolean;
  isSupportSession: boolean;
  supportSessionPlatformUserId: string | undefined;
  emailVerified: boolean;
};

const SessionContext = React.createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<SessionState>({ status: "loading" });

  const refetch = React.useCallback(async () => {
    try {
      const data = await apiFetch<SessionResponse>("/api/auth/session");
      setState({ status: "authenticated", data });
    } catch (e) {
      const status = e && typeof e === "object" && "status" in e ? (e as { status: number }).status : 0;
      if (status === 401) {
        setState({ status: "unauthenticated" });
      } else {
        setState({
          status: "error",
          message: e instanceof Error ? e.message : "Failed to load session",
        });
      }
    }
  }, []);

  React.useEffect(() => {
    refetch();
  }, [refetch]);

  const value: SessionContextValue = React.useMemo(() => {
    const user = state.status === "authenticated" ? state.data.user : null;
    const activeDealership = state.status === "authenticated" ? state.data.activeDealership : null;
    const lifecycleStatus = state.status === "authenticated" ? state.data.lifecycleStatus ?? null : null;
    const lastStatusReason = state.status === "authenticated" ? (state.data.lastStatusReason ?? null) : null;
    const closedDealership = state.status === "authenticated" ? state.data.closedDealership ?? null : null;
    const permissions = state.status === "authenticated" ? state.data.permissions : [];
    const pendingApproval = state.status === "authenticated" ? state.data.pendingApproval === true : false;
    const isSupportSession = state.status === "authenticated" ? state.data.isSupportSession === true : false;
    const supportSessionPlatformUserId = state.status === "authenticated" ? state.data.supportSessionPlatformUserId : undefined;
    const emailVerified = state.status === "authenticated" ? (state.data.emailVerified !== false) : true;

    return {
      state,
      refetch,
      hasPermission: (key: string) => permissions.includes(key),
      user,
      activeDealership,
      lifecycleStatus,
      lastStatusReason,
      closedDealership,
      permissions,
      pendingApproval,
      isSupportSession,
      supportSessionPlatformUserId,
      emailVerified,
    };
  }, [state, refetch]);

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = React.useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
