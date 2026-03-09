/**
 * Step 4 — Security & QA: Customers page server component.
 * - When session lacks customers.read, list and summary services are not called and client receives canRead=false.
 */
jest.mock("next/cache", () => ({
  noStore: jest.fn(),
  unstable_noStore: jest.fn(),
}));

jest.mock("@/lib/api/handler", () => ({
  getSessionContextOrNull: jest.fn(),
}));

jest.mock("@/modules/customers/service/customer", () => ({
  listCustomers: jest.fn(),
  getCustomerSummaryMetrics: jest.fn(),
}));

jest.mock("@/modules/customers/service/saved-filters", () => ({
  listSavedFilters: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/modules/customers/service/saved-searches", () => ({
  listSavedSearches: jest.fn().mockResolvedValue([]),
}));

import { getSessionContextOrNull } from "@/lib/api/handler";
import * as customerService from "@/modules/customers/service/customer";
import Page from "../page";

async function renderPage(searchParams: Record<string, string | string[] | undefined> = {}, session: { activeDealershipId: string | null; permissions: string[] } | null) {
  (getSessionContextOrNull as jest.Mock).mockResolvedValue(session);
  (customerService.listCustomers as jest.Mock).mockResolvedValue({ data: [], total: 0 });
  (customerService.getCustomerSummaryMetrics as jest.Mock).mockResolvedValue({
    totalCustomers: 0,
    totalLeads: 0,
    activeCustomers: 0,
    activeCount: 0,
    inactiveCustomers: 0,
  });
  const searchParamsPromise = Promise.resolve(searchParams);
  return Page({ searchParams: searchParamsPromise });
}

describe("Customers page server component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does not call listCustomers or getCustomerSummaryMetrics when session lacks customers.read", async () => {
    await renderPage(
      {},
      { activeDealershipId: "dealership-1", permissions: ["deals.read"] }
    );
    expect(customerService.listCustomers).not.toHaveBeenCalled();
    expect(customerService.getCustomerSummaryMetrics).not.toHaveBeenCalled();
  });

  it("does not call listCustomers or getCustomerSummaryMetrics when activeDealershipId is null", async () => {
    await renderPage(
      {},
      { activeDealershipId: null, permissions: ["customers.read"] }
    );
    expect(customerService.listCustomers).not.toHaveBeenCalled();
    expect(customerService.getCustomerSummaryMetrics).not.toHaveBeenCalled();
  });

  it("calls listCustomers and getCustomerSummaryMetrics when session has customers.read and dealership", async () => {
    await renderPage(
      {},
      { activeDealershipId: "dealership-1", permissions: ["customers.read"] }
    );
    expect(customerService.listCustomers).toHaveBeenCalledWith(
      "dealership-1",
      expect.objectContaining({
        limit: 25,
        offset: 0,
      })
    );
    expect(customerService.getCustomerSummaryMetrics).toHaveBeenCalledWith("dealership-1");
  });
});
