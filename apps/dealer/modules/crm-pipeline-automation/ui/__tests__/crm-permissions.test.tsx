/**
 * CRM UI permission gate tests: no fetch when !crm.read; no-access message rendered.
 */
import React from "react";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { CrmBoardPage } from "../CrmBoardPage";
import { OpportunitiesTablePage } from "../OpportunitiesTablePage";
import { OpportunityDetailPage } from "../OpportunityDetailPage";
import { JobsPage } from "../JobsPage";
import { AutomationRulesPage } from "../AutomationRulesPage";
import { SequencesPage } from "../SequencesPage";
import { shouldFetchCrm } from "../crm-guards";

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
  usePathname: () => "/crm/opportunities",
  useSearchParams: () => new URLSearchParams(),
}));

describe("shouldFetchCrm guard", () => {
  it("returns false when canRead is false", () => {
    expect(shouldFetchCrm(false)).toBe(false);
  });

  it("returns true when canRead is true", () => {
    expect(shouldFetchCrm(true)).toBe(true);
  });
});

describe("CRM UI: no fetch when !crm.read", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    ((globalThis as unknown as { fetch: typeof mockFetch }).fetch = mockFetch);
  });

  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  it("CrmBoardPage shows no-access and makes no /api/crm calls when !crm.read", async () => {
    mockPermissions = [];
    const { container } = render(<CrmBoardPage />);
    expect(container.textContent).toMatch(/You don't have access to CRM/i);
    await waitFor(() => {});
    const crmCalls = mockFetch.mock.calls.filter((c: [string]) => String(c[0]).includes("/api/crm"));
    expect(crmCalls.length).toBe(0);
  });

  it("OpportunitiesTablePage shows no-access and makes no /api/crm calls when !crm.read", async () => {
    mockPermissions = [];
    const { container } = render(<OpportunitiesTablePage />);
    expect(container.textContent).toMatch(/You don't have access to CRM/i);
    await waitFor(() => {});
    const crmCalls = mockFetch.mock.calls.filter((c: [string]) => String(c[0]).includes("/api/crm"));
    expect(crmCalls.length).toBe(0);
  });

  it("OpportunityDetailPage shows no-access and makes no /api/crm calls when !crm.read", async () => {
    mockPermissions = [];
    const { container } = render(<OpportunityDetailPage opportunityId="00000000-0000-0000-0000-000000000001" />);
    expect(container.textContent).toMatch(/You don't have access to CRM/i);
    await waitFor(() => {});
    const crmCalls = mockFetch.mock.calls.filter((c: [string]) => String(c[0]).includes("/api/crm"));
    expect(crmCalls.length).toBe(0);
  });

  it("JobsPage shows no-access and makes no /api/crm calls when !crm.read", async () => {
    mockPermissions = [];
    const { container } = render(<JobsPage />);
    expect(container.textContent).toMatch(/You don't have access to CRM/i);
    await waitFor(() => {});
    const crmCalls = mockFetch.mock.calls.filter((c: [string]) => String(c[0]).includes("/api/crm"));
    expect(crmCalls.length).toBe(0);
  });

  it("AutomationRulesPage shows no-access when !crm.read", async () => {
    mockPermissions = [];
    const { container } = render(<AutomationRulesPage />);
    expect(container.textContent).toMatch(/You don't have access to CRM/i);
    const crmCalls = mockFetch.mock.calls.filter((c: [string]) => String(c[0]).includes("/api/crm"));
    expect(crmCalls.length).toBe(0);
  });

  it("SequencesPage shows no-access when !crm.read", async () => {
    mockPermissions = [];
    const { container } = render(<SequencesPage />);
    expect(container.textContent).toMatch(/You don't have access to CRM/i);
    const crmCalls = mockFetch.mock.calls.filter((c: [string]) => String(c[0]).includes("/api/crm"));
    expect(crmCalls.length).toBe(0);
  });
});

describe("CRM UI: mutation controls hidden when crm.read but !crm.write", () => {
  const listResponse = () =>
    new Response(
      JSON.stringify({ data: [], meta: { total: 0, limit: 25, offset: 0 } }),
      { status: 200, headers: { "content-type": "application/json" } }
    );

  beforeEach(() => {
    mockFetch.mockReset();
    mockPermissions = ["crm.read"];
    mockFetch.mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : (input as URL).href;
      if (url.includes("/api/crm")) return listResponse();
      return new Response("", { status: 404 });
    });
    ((globalThis as unknown as { fetch: typeof mockFetch }).fetch = mockFetch);
  });

  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  it("AutomationRulesPage does not show Create rule when !crm.write", async () => {
    render(<AutomationRulesPage />);
    await waitFor(() => {
      expect(mockFetch.mock.calls.some((c: [string]) => String(c[0]).includes("/api/crm"))).toBe(true);
    });
    expect(screen.queryByRole("button", { name: /create rule/i })).toBeNull();
  });

  it("SequencesPage does not show Create template when !crm.write", async () => {
    render(<SequencesPage />);
    await waitFor(() => {
      expect(mockFetch.mock.calls.some((c: [string]) => String(c[0]).includes("/api/crm"))).toBe(true);
    });
    expect(screen.queryByRole("button", { name: /create template/i })).toBeNull();
  });
});
