/**
 * Test helpers for CRM UI: mock SessionProvider and optional ToastProvider.
 */
import * as React from "react";

const defaultPermissions: string[] = [];

export function createMockSessionProvider(initialPermissions: string[] = defaultPermissions) {
  const permissions = [...initialPermissions];
  return function MockSessionProvider({
    children,
    permissions: permOverride,
  }: {
    children: React.ReactNode;
    permissions?: string[];
  }) {
    const perms = permOverride ?? permissions;
    const value = {
      state: { status: "authenticated" as const, data: {} },
      refetch: () => Promise.resolve(),
      hasPermission: (key: string) => perms.includes(key),
      user: null,
      activeDealership: null,
      permissions: perms,
    };
    return (
      <MockSessionContext.Provider value={value}>
        {children}
      </MockSessionContext.Provider>
    );
  };
}

const MockSessionContext = React.createContext<{
  hasPermission: (key: string) => boolean;
} | null>(null);

export function useMockSession() {
  const ctx = React.useContext(MockSessionContext);
  if (!ctx) throw new Error("useMockSession must be used within MockSessionProvider");
  return ctx;
}

describe("test-utils (shared helpers)", () => {
  it("exports createMockSessionProvider and useMockSession", () => {
    expect(typeof createMockSessionProvider).toBe("function");
    expect(typeof useMockSession).toBe("function");
  });
});
