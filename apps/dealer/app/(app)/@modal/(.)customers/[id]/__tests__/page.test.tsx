/**
 * Step 4 — Security & QA: Customer detail modal page (intercepting route).
 * - Non-UUID id: getCustomer is not called; client receives errorKind="invalid_id".
 */
jest.mock("next/cache", () => ({
  unstable_noStore: jest.fn(),
}));

jest.mock("@/lib/api/handler", () => ({
  getSessionContextOrNull: jest.fn(),
}));

jest.mock("@/modules/customers/service/customer", () => ({
  getCustomer: jest.fn(),
}));

import { getSessionContextOrNull } from "@/lib/api/handler";
import * as customerService from "@/modules/customers/service/customer";
import Page from "../page";

async function renderModalPage(id: string, session: { activeDealershipId: string; permissions: string[] } | null) {
  (getSessionContextOrNull as jest.Mock).mockResolvedValue(session);
  (customerService.getCustomer as jest.Mock).mockResolvedValue({ id, name: "Test", status: "LEAD" });
  const params = Promise.resolve({ id });
  return Page({ params });
}

describe("Customer detail modal page (intercepting route)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does not call getCustomer when id is not a valid UUID", async () => {
    await renderModalPage("not-a-uuid", {
      activeDealershipId: "dealership-1",
      permissions: ["customers.read"],
    });
    expect(customerService.getCustomer).not.toHaveBeenCalled();
  });

  it("does not call getCustomer when session lacks customers.read", async () => {
    await renderModalPage("c1000000-0000-0000-0000-000000000001", {
      activeDealershipId: "dealership-1",
      permissions: ["deals.read"],
    });
    expect(customerService.getCustomer).not.toHaveBeenCalled();
  });
});
