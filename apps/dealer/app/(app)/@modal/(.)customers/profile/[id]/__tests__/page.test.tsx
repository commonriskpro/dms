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

describe("Customer detail modal page (namespaced intercepting route)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does not call getCustomer when id is not a valid UUID", async () => {
    (getSessionContextOrNull as jest.Mock).mockResolvedValue({
      activeDealershipId: "dealership-1",
      permissions: ["customers.read"],
    });

    await Page({ params: Promise.resolve({ id: "not-a-uuid" }) });
    expect(customerService.getCustomer).not.toHaveBeenCalled();
  });

  it("does not call getCustomer when session lacks customers.read", async () => {
    (getSessionContextOrNull as jest.Mock).mockResolvedValue({
      activeDealershipId: "dealership-1",
      permissions: ["deals.read"],
    });

    await Page({
      params: Promise.resolve({ id: "c1000000-0000-0000-0000-000000000001" }),
    });

    expect(customerService.getCustomer).not.toHaveBeenCalled();
  });
});
