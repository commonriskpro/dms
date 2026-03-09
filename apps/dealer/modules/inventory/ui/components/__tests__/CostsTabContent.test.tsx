/**
 * Vehicle Costs Tab Hybrid UI — CostsTabContent: permission gate, loading, loaded content,
 * Acquisition Summary / Cost Totals / Cost Ledger, document rail visibility.
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { CostsTabContent } from "../CostsTabContent";

const mockApiFetch = jest.fn();
jest.mock("@/lib/client/http", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
  getApiErrorMessage: (e: unknown) => (e instanceof Error ? e.message : "Error"),
}));

let mockPermissions: string[] = ["inventory.read"];
jest.mock("@/contexts/session-context", () => ({
  useSession: () => ({
    hasPermission: (key: string) => mockPermissions.includes(key),
  }),
}));

jest.mock("@/components/toast", () => ({
  useToast: () => ({ addToast: jest.fn() }),
}));

jest.mock("@/components/ui/confirm-dialog", () => ({
  confirm: () => Promise.resolve(false),
}));

const vehicleId = "a1000000-0000-0000-0000-000000000001";

const costResponse = {
  data: {
    vehicleId,
    auctionCostCents: "1000000",
    transportCostCents: "50000",
    reconCostCents: "200000",
    miscCostCents: "25000",
    totalCostCents: "1275000",
    acquisitionSubtotalCents: "1000000",
    reconSubtotalCents: "200000",
    feesSubtotalCents: "75000",
    totalInvestedCents: "1275000",
  },
};

const entriesResponse = {
  data: [
    {
      id: "e1000000-0000-0000-0000-000000000001",
      vehicleId,
      category: "acquisition",
      amountCents: "1000000",
      vendorName: "Auction Co",
      occurredAt: "2025-01-15T12:00:00.000Z",
      memo: "Purchase",
      createdByUserId: "u1",
      createdAt: "2025-01-15T12:00:00.000Z",
      updatedAt: "2025-01-15T12:00:00.000Z",
    },
  ],
};

const documentsResponse = { data: [] };

describe("CostsTabContent", () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
    mockPermissions = ["inventory.read"];
    mockApiFetch
      .mockResolvedValueOnce(costResponse)
      .mockResolvedValueOnce(entriesResponse)
      .mockResolvedValueOnce(documentsResponse);
  });

  it("renders nothing when user lacks inventory.read", () => {
    mockPermissions = [];
    const { container } = render(<CostsTabContent vehicleId={vehicleId} />);
    expect(container.firstChild).toBeNull();
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it("shows loading skeleton then content when user has inventory.read", async () => {
    render(<CostsTabContent vehicleId={vehicleId} />);
    await waitFor(() => {
      expect(screen.getByText("Acquisition Summary")).toBeInTheDocument();
    });
    expect(screen.getByText("Cost Totals")).toBeInTheDocument();
    expect(screen.getByText("Cost Ledger")).toBeInTheDocument();
  });

  it("fetches cost, cost-entries, and cost-documents when inventory.read and documents.read", async () => {
    mockPermissions = ["inventory.read", "documents.read"];
    render(<CostsTabContent vehicleId={vehicleId} />);
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(`/api/inventory/${vehicleId}/cost`);
      expect(mockApiFetch).toHaveBeenCalledWith(
        `/api/inventory/${vehicleId}/cost-entries`
      );
      expect(mockApiFetch).toHaveBeenCalledWith(
        `/api/inventory/${vehicleId}/cost-documents`
      );
    });
  });

  it("does not fetch cost-documents when user lacks documents.read", async () => {
    mockPermissions = ["inventory.read"];
    render(<CostsTabContent vehicleId={vehicleId} />);
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(`/api/inventory/${vehicleId}/cost`);
      expect(mockApiFetch).toHaveBeenCalledWith(
        `/api/inventory/${vehicleId}/cost-entries`
      );
    });
    expect(mockApiFetch).not.toHaveBeenCalledWith(
      `/api/inventory/${vehicleId}/cost-documents`
    );
  });

  it("shows acquisition vendor and totals from data", async () => {
    render(<CostsTabContent vehicleId={vehicleId} />);
    await waitFor(() => {
      expect(screen.getByText("Cost Ledger")).toBeInTheDocument();
    });
    expect(screen.getAllByText("Auction Co").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("$10,000.00").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("$12,750.00").length).toBeGreaterThanOrEqual(1);
  });

  it("shows Add Cost button only when user has inventory.write", async () => {
    render(<CostsTabContent vehicleId={vehicleId} />);
    await waitFor(() => {
      expect(screen.getByText("Cost Ledger")).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: /add cost/i })).not.toBeInTheDocument();

    mockPermissions = ["inventory.read", "inventory.write"];
    mockApiFetch
      .mockResolvedValueOnce(costResponse)
      .mockResolvedValueOnce(entriesResponse)
      .mockResolvedValueOnce(documentsResponse);
    const { unmount } = render(<CostsTabContent vehicleId={vehicleId} />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /add cost/i })).toBeInTheDocument();
    });
    unmount();
  });

  it("renders No cost entries yet when entries array is empty", async () => {
    mockApiFetch.mockReset();
    mockApiFetch
      .mockResolvedValueOnce(costResponse)
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce(documentsResponse);
    render(<CostsTabContent vehicleId={vehicleId} />);
    await waitFor(() => {
      expect(screen.getByText("Cost Ledger")).toBeInTheDocument();
    });
    expect(screen.getByText("No cost entries yet.")).toBeInTheDocument();
  });
});
