/**
 * Deep-link guard: landing on CRM detail/board without crm.read shows no-access and no fetch.
 */
import React from "react";
import { render, cleanup, waitFor } from "@testing-library/react";
import { OpportunityDetailPage } from "../OpportunityDetailPage";
import { CrmBoardPage } from "../CrmBoardPage";

let mockPermissions: string[] = [];
const mockFetch = jest.fn();

jest.mock("@/contexts/session-context", () => ({
  useSession: () => ({
    hasPermission: (key: string) => mockPermissions.includes(key),
  }),
}));

jest.mock("@/components/toast", () => ({
  useToast: () => ({ addToast: jest.fn() }),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

describe("Deep-link: no fetch when !crm.read", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    ((globalThis as unknown as { fetch: typeof mockFetch }).fetch = mockFetch);
  });

  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  it("OpportunityDetailPage with valid id but !crm.read shows no-access and makes no /api/crm calls", async () => {
    mockPermissions = [];
    const { container } = render(
      <OpportunityDetailPage opportunityId="00000000-0000-0000-0000-000000000001" />
    );
    expect(container.textContent).toMatch(/You don't have access to CRM/i);
    await waitFor(() => {});
    const crmCalls = mockFetch.mock.calls.filter((c: [string]) => String(c[0]).includes("/api/crm"));
    expect(crmCalls.length).toBe(0);
  });

  it("CrmBoardPage deep-linked without crm.read shows no-access and no fetch", async () => {
    mockPermissions = [];
    const { container } = render(<CrmBoardPage />);
    expect(container.textContent).toMatch(/You don't have access to CRM/i);
    await waitFor(() => {});
    const crmCalls = mockFetch.mock.calls.filter((c: [string]) => String(c[0]).includes("/api/crm"));
    expect(crmCalls.length).toBe(0);
  });
});
