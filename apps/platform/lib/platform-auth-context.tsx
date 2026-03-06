"use client";

import * as React from "react";

type PlatformAuthContextValue = { userId: string | null; role: string | null };

const PlatformAuthContext = React.createContext<PlatformAuthContextValue>({
  userId: null,
  role: null,
});

export function PlatformAuthProvider({
  userId,
  role,
  children,
}: {
  userId: string | null;
  role: string | null;
  children: React.ReactNode;
}) {
  const value = React.useMemo(() => ({ userId, role }), [userId, role]);
  return (
    <PlatformAuthContext.Provider value={value}>
      {children}
    </PlatformAuthContext.Provider>
  );
}

export function usePlatformAuthContext() {
  return React.useContext(PlatformAuthContext);
}
