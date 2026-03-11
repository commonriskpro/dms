"use client";

import * as React from "react";
import { useSession } from "@/contexts/session-context";
import type { SessionLifecycleStatus } from "@/lib/types/session";

type DealerLifecycleStatus = SessionLifecycleStatus;

type DealerLifecycleContextValue = {
  status: DealerLifecycleStatus | null;
  isActive: boolean;
  isSuspended: boolean;
  isClosed: boolean;
  closedDealership: { id: string; name: string } | null;
  /** When suspended, optional reason from platform (if API provides it). */
  lastStatusReason: string | null;
};

const DEFAULT_LIFECYCLE_VALUE: DealerLifecycleContextValue = {
  status: "ACTIVE",
  isActive: true,
  isSuspended: false,
  isClosed: false,
  closedDealership: null,
  lastStatusReason: null,
};

const DealerLifecycleContext = React.createContext<DealerLifecycleContextValue | null>(null);

export function DealerLifecycleProvider({ children }: { children: React.ReactNode }) {
  const { state, activeDealership, lifecycleStatus, lastStatusReason, closedDealership } = useSession();

  const value: DealerLifecycleContextValue = React.useMemo(() => {
    const status: DealerLifecycleStatus | null =
      lifecycleStatus ?? (activeDealership ? "ACTIVE" : null);
    return {
      status,
      isActive: status === "ACTIVE",
      isSuspended: status === "SUSPENDED",
      isClosed: status === "CLOSED",
      closedDealership: closedDealership ?? null,
      lastStatusReason: lastStatusReason ?? null,
    };
  }, [activeDealership, lifecycleStatus, lastStatusReason, closedDealership]);

  return (
    <DealerLifecycleContext.Provider value={value}>
      {children}
    </DealerLifecycleContext.Provider>
  );
}

export function useDealerLifecycle(): DealerLifecycleContextValue {
  const ctx = React.useContext(DealerLifecycleContext);
  /** When outside provider (e.g. in unit tests), assume ACTIVE so write controls are enabled. */
  return ctx ?? DEFAULT_LIFECYCLE_VALUE;
}
