/**
 * Global search UI: permission gate, debounced API call, keyboard nav, click navigation.
 */
import React from "react";
import { render, screen, within, cleanup, fireEvent, waitFor, act } from "@testing-library/react";
import { GlobalSearch } from "../GlobalSearch";

let mockPermissions: string[] = [];
const mockActiveDealership = { id: "d1", name: "Test Dealer" };
const mockApiFetch = jest.fn();
const mockPush = jest.fn();

jest.mock("@/contexts/session-context", () => ({
  useSession: () => ({
    hasPermission: (key: string) => mockPermissions.includes(key),
    activeDealership: mockActiveDealership,
  }),
}));

jest.mock("@/lib/client/http", () => ({
  apiFetch: (url: string) => mockApiFetch(url),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe("GlobalSearch: no API call when user has no search permission", () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
    mockPush.mockReset();
    mockPermissions = [];
  });

  afterEach(() => {
    cleanup();
    jest.useRealTimers();
  });

  it("does not render search input and does not call GET /api/search when user lacks all of customers.read, deals.read, inventory.read", () => {
    render(<GlobalSearch />);
    expect(screen.queryByPlaceholderText(/Search inventory, customers, deals/)).not.toBeInTheDocument();
    expect(mockApiFetch).not.toHaveBeenCalled();
  });
});

describe("GlobalSearch: debounced GET /api/search when user has permission", () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
    mockPush.mockReset();
    mockPermissions = ["customers.read"];
    mockApiFetch.mockResolvedValue({ data: [], meta: { limit: 20, offset: 0 } });
    jest.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    jest.useRealTimers();
  });

  it("triggers GET /api/search with q and limit=20 after 300ms debounce", async () => {
    const { container } = render(<GlobalSearch />);
    const input = within(container).getByPlaceholderText(/Search inventory, customers, deals/);
    fireEvent.change(input, { target: { value: "ab" } });
    expect(mockApiFetch).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockApiFetch).toHaveBeenCalledTimes(1);
    const url = mockApiFetch.mock.calls[0][0];
    expect(url).toContain("/api/search");
    expect(url).toMatch(/[?&]q=ab(&|$)/);
    expect(url).toMatch(/[?&]limit=20(&|$)/);
  });
});

describe("GlobalSearch: keyboard navigation", () => {
  const customerId = "c1111111-1111-1111-1111-111111111111";
  const dealId = "a2222222-2222-2222-2222-222222222222";
  const mockData = {
    data: [
      { type: "customer" as const, id: customerId, name: "Alice", primaryPhone: "555-001", primaryEmail: "a@b.com" },
      { type: "deal" as const, id: dealId, stockNumber: "S1", customerName: "Bob" },
    ],
    meta: { limit: 20, offset: 0 },
  };

  beforeEach(() => {
    mockApiFetch.mockReset();
    mockPush.mockReset();
    mockPermissions = ["customers.read", "deals.read"];
    mockApiFetch.mockResolvedValue(mockData);
  });

  afterEach(() => {
    cleanup();
  });

  it("Arrow Down/Up moves highlight; Enter navigates to focused item", async () => {
    const { container } = render(<GlobalSearch />);
    const input = within(container).getByPlaceholderText(/Search inventory, customers, deals/);
    fireEvent.change(input, { target: { value: "ab" } });
    await waitFor(
      () => {
        expect(within(container).getByRole("option", { name: /Alice/ })).toBeInTheDocument();
      },
      { timeout: 2000 }
    );
    expect(mockApiFetch).toHaveBeenCalled();

    // First result is auto-focused (highlightedIndex 0). One Arrow Down moves to second (deal), then Enter.
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith("/deals/" + dealId);
  }, 8000);
});

describe("GlobalSearch: clicking result navigates by type", () => {
  const customerId = "c1111111-1111-1111-1111-111111111111";
  const dealId = "a2222222-2222-2222-2222-222222222222";
  const inventoryId = "v3333333-3333-3333-3333-333333333333";
  const mockData = {
    data: [
      { type: "customer" as const, id: customerId, name: "Alice", primaryPhone: null, primaryEmail: null },
      { type: "deal" as const, id: dealId, stockNumber: "S1", customerName: "Bob" },
      {
        type: "inventory" as const,
        id: inventoryId,
        vin: "1HGBH41JXMN109186",
        stockNumber: "STK1",
        yearMakeModel: "2020 Honda Accord",
      },
    ],
    meta: { limit: 20, offset: 0 },
  };

  beforeEach(() => {
    mockApiFetch.mockReset();
    mockPush.mockReset();
    mockPermissions = ["customers.read", "deals.read", "inventory.read"];
    mockApiFetch.mockResolvedValue(mockData);
  });

  afterEach(() => {
    cleanup();
  });

  it("clicking customer row navigates to /customers/profile/[id]", async () => {
    const { container } = render(<GlobalSearch />);
    const input = within(container).getByPlaceholderText(/Search inventory, customers, deals/);
    fireEvent.change(input, { target: { value: "al" } });
    const customerRow = await within(container).findByRole("option", { name: /Alice/i, timeout: 2000 });
    fireEvent.mouseDown(customerRow);
    expect(mockPush).toHaveBeenCalledWith("/customers/profile/" + customerId);
  }, 8000);

  it("clicking deal row navigates to /deals/[id]", async () => {
    const { container } = render(<GlobalSearch />);
    const input = within(container).getByPlaceholderText(/Search inventory, customers, deals/);
    fireEvent.change(input, { target: { value: "s1" } });
    const dealRow = await within(container).findByRole("option", { name: /S1|Bob/, timeout: 2000 });
    fireEvent.mouseDown(dealRow);
    expect(mockPush).toHaveBeenCalledWith("/deals/" + dealId);
  }, 8000);

  it("clicking inventory row navigates to /inventory/vehicle/[id]", async () => {
    const { container } = render(<GlobalSearch />);
    const input = within(container).getByPlaceholderText(/Search inventory, customers, deals/);
    fireEvent.change(input, { target: { value: "stk" } });
    const invRow = await within(container).findByRole("option", { name: /2020 Honda Accord|STK1/, timeout: 2000 });
    fireEvent.mouseDown(invRow);
    expect(mockPush).toHaveBeenCalledWith("/inventory/vehicle/" + inventoryId);
  }, 8000);
});
