/**
 * Platform layout: when session.platformAdmin.isAdmin is false, show access denied
 * and do not render children (so no apiFetch to /api/platform/* runs).
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import PlatformLayout from "../layout";

const mockFetch = jest.fn();
const mockApiFetch = jest.fn();

jest.mock("@/contexts/session-context", () => ({
  useSession: () => ({
    state: { status: "authenticated" as const },
    platformAdmin: { isAdmin: false },
  }),
}));

jest.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div data-testid="app-shell">{children}</div>,
}));

jest.mock("@/lib/client/http", () => ({
  apiFetch: (url: string) => mockApiFetch(url),
}));

describe("Platform layout: non-admin", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockApiFetch.mockReset();
    ((globalThis as unknown as { fetch: typeof mockFetch }).fetch = mockFetch);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("shows access denied when platformAdmin.isAdmin is false", () => {
    render(
      <PlatformLayout>
        <div data-testid="platform-child">Child content</div>
      </PlatformLayout>
    );
    expect(screen.getByText(/you don't have access to platform admin/i)).toBeInTheDocument();
    expect(screen.queryByTestId("platform-child")).not.toBeInTheDocument();
  });

  it("does not call fetch to /api/platform/* when not platform admin", () => {
    render(
      <PlatformLayout>
        <div>Child</div>
      </PlatformLayout>
    );
    const platformCalls = mockFetch.mock.calls.filter(
      (call: [string]) => typeof call[0] === "string" && call[0].includes("/api/platform/")
    );
    expect(platformCalls).toHaveLength(0);
  });

  it("does not call apiFetch to /api/platform/* when not platform admin", () => {
    render(
      <PlatformLayout>
        <div>Child</div>
      </PlatformLayout>
    );
    expect(mockApiFetch).not.toHaveBeenCalled();
    const platformApiCalls = mockApiFetch.mock.calls.filter(
      (call: [string]) => typeof call[0] === "string" && call[0].includes("/api/platform/")
    );
    expect(platformApiCalls).toHaveLength(0);
  });
});
