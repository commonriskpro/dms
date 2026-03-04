/**
 * Platform layout: when session.platformAdmin.isAdmin is false, show access denied
 * and do not render children (so no apiFetch to /api/platform/* runs).
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import PlatformLayout from "../layout";

const mockFetch = vi.fn();
const mockApiFetch = vi.fn();

vi.mock("@/contexts/session-context", () => ({
  useSession: () => ({
    state: { status: "authenticated" as const },
    platformAdmin: { isAdmin: false },
  }),
}));

vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div data-testid="app-shell">{children}</div>,
}));

vi.mock("@/lib/client/http", () => ({
  apiFetch: (url: string) => mockApiFetch(url),
}));

describe("Platform layout: non-admin", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockApiFetch.mockReset();
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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
