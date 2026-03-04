/**
 * Deep-link guard: landing on CRM detail/board without crm.read shows no-access and no fetch.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { OpportunityDetailPage } from "../OpportunityDetailPage";
import { CrmBoardPage } from "../CrmBoardPage";

let mockPermissions: string[] = [];
const mockFetch = vi.fn();

vi.mock("@/contexts/session-context", () => ({
  useSession: () => ({
    hasPermission: (key: string) => mockPermissions.includes(key),
  }),
}));

vi.mock("@/components/toast", () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("Deep-link: no fetch when !crm.read", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("OpportunityDetailPage with valid id but !crm.read shows no-access and makes no /api/crm calls", async () => {
    mockPermissions = [];
    const { container } = render(
      <OpportunityDetailPage opportunityId="00000000-0000-0000-0000-000000000001" />
    );
    expect(container.textContent).toMatch(/You don't have access to CRM/i);
    await vi.waitFor(() => {});
    const crmCalls = mockFetch.mock.calls.filter((c: [string]) => String(c[0]).includes("/api/crm"));
    expect(crmCalls.length).toBe(0);
  });

  it("CrmBoardPage deep-linked without crm.read shows no-access and no fetch", async () => {
    mockPermissions = [];
    const { container } = render(<CrmBoardPage />);
    expect(container.textContent).toMatch(/You don't have access to CRM/i);
    await vi.waitFor(() => {});
    const crmCalls = mockFetch.mock.calls.filter((c: [string]) => String(c[0]).includes("/api/crm"));
    expect(crmCalls.length).toBe(0);
  });
});
