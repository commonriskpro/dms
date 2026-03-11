import { render } from "@testing-library/react";

jest.mock("../InboxPageClient", () => ({
  InboxPageClient: jest.fn(() => null),
}));

import { InboxPageClient } from "../InboxPageClient";
import Page from "../page";

describe("CRM inbox route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("passes customerId through to the inbox client", async () => {
    const element = await Page({
      searchParams: Promise.resolve({
        customerId: "customer-123",
      }),
    });

    render(element);

    expect(InboxPageClient).toHaveBeenCalledWith(
      expect.objectContaining({
        initialCustomerId: "customer-123",
      }),
      undefined
    );
  });

  it("falls back to null when no customerId is present", async () => {
    const element = await Page({
      searchParams: Promise.resolve({}),
    });

    render(element);

    expect(InboxPageClient).toHaveBeenCalledWith(
      expect.objectContaining({
        initialCustomerId: null,
      }),
      undefined
    );
  });
});
