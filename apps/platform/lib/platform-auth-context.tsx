"use client";

import * as React from "react";

type PlatformAuthContextValue = { userId: string | null; role: string | null; emailVerified: boolean };

const PlatformAuthContext = React.createContext<PlatformAuthContextValue>({
  userId: null,
  role: null,
  emailVerified: true,
});

export function PlatformAuthProvider({
  userId,
  role,
  emailVerified = true,
  children,
}: {
  userId: string | null;
  role: string | null;
  emailVerified?: boolean;
  children: React.ReactNode;
}) {
  const value = React.useMemo(() => ({ userId, role, emailVerified }), [userId, role, emailVerified]);
  return (
    <PlatformAuthContext.Provider value={value}>
      {children}
    </PlatformAuthContext.Provider>
  );
}

export function usePlatformAuthContext() {
  return React.useContext(PlatformAuthContext);
}
