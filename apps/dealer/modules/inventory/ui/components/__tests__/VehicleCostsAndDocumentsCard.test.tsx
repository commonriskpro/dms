/**
 * Vehicle Cost Ledger V1 — Costs & Documents card: rendering, permission gating,
 * lifecycle (refetch after mutations), empty states, document view, totals/acquisition summary.
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VehicleCostsAndDocumentsCard } from "../VehicleCostsAndDocumentsCard";

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

describe("VehicleCostsAndDocumentsCard", () => {
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
    const { container } = render(
      <VehicleCostsAndDocumentsCard vehicleId={vehicleId} />
    );
    expect(container.firstChild).toBeNull();
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it("fetches cost, cost-entries, and cost-documents when inventory.read and documents.read", async () => {
    mockPermissions = ["inventory.read", "documents.read"];
    render(<VehicleCostsAndDocumentsCard vehicleId={vehicleId} />);
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        `/api/inventory/${vehicleId}/cost`
      );
      expect(mockApiFetch).toHaveBeenCalledWith(
        `/api/inventory/${vehicleId}/cost-entries`
      );
      expect(mockApiFetch).toHaveBeenCalledWith(
        `/api/inventory/${vehicleId}/cost-documents`
      );
    });
  });

  it("shows Costs & Documents title and Acquisition summary block when loaded", async () => {
    render(<VehicleCostsAndDocumentsCard vehicleId={vehicleId} />);
    await waitFor(() => {
      expect(screen.getByText("Costs & Documents")).toBeInTheDocument();
    });
    expect(screen.getByText("Acquisition summary")).toBeInTheDocument();
    expect(screen.getByText("Cost totals")).toBeInTheDocument();
    expect(screen.getByText("Cost ledger")).toBeInTheDocument();
  });

  it("shows acquisition vendor and total invested from ledger data", async () => {
    render(<VehicleCostsAndDocumentsCard vehicleId={vehicleId} />);
    await waitFor(() => {
      expect(screen.getByText("Cost ledger")).toBeInTheDocument();
    });
    expect(screen.getAllByText("Auction Co").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("$10,000.00").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("$12,750.00").length).toBeGreaterThanOrEqual(1);
  });

  it("shows Add cost entry button only when user has inventory.write", async () => {
    render(<VehicleCostsAndDocumentsCard vehicleId={vehicleId} />);
    await waitFor(() => {
      expect(screen.getByText("Cost ledger")).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: /add cost entry/i })).not.toBeInTheDocument();

    mockPermissions = ["inventory.read", "inventory.write"];
    mockApiFetch
      .mockResolvedValueOnce(costResponse)
      .mockResolvedValueOnce(entriesResponse);
    const { unmount } = render(<VehicleCostsAndDocumentsCard vehicleId={vehicleId} />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /add cost entry/i })).toBeInTheDocument();
    });
    unmount();
  });

  it("shows Documents section and Add document when user has documents.read and inventory.write and documents.write", async () => {
    mockPermissions = ["inventory.read", "inventory.write", "documents.read", "documents.write"];
    mockApiFetch
      .mockResolvedValueOnce(costResponse)
      .mockResolvedValueOnce(entriesResponse)
      .mockResolvedValueOnce(documentsResponse);
    render(<VehicleCostsAndDocumentsCard vehicleId={vehicleId} />);
    await waitFor(() => {
      expect(screen.getByText("Documents")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /add document/i })).toBeInTheDocument();
  });

  it("does not fetch cost-documents when user lacks documents.read", async () => {
    mockPermissions = ["inventory.read"];
    render(<VehicleCostsAndDocumentsCard vehicleId={vehicleId} />);
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        `/api/inventory/${vehicleId}/cost`
      );
      expect(mockApiFetch).toHaveBeenCalledWith(
        `/api/inventory/${vehicleId}/cost-entries`
      );
    });
    expect(mockApiFetch).not.toHaveBeenCalledWith(
      `/api/inventory/${vehicleId}/cost-documents`
    );
  });

  it("renders No cost entries yet when entries array is empty", async () => {
    mockApiFetch.mockReset();
    mockApiFetch
      .mockResolvedValueOnce(costResponse)
      .mockResolvedValueOnce({ data: [] });
    render(<VehicleCostsAndDocumentsCard vehicleId={vehicleId} />);
    await waitFor(() => {
      expect(screen.getByText("Cost ledger")).toBeInTheDocument();
    });
    expect(screen.getByText("No cost entries yet.")).toBeInTheDocument();
  });

  it("renders No documents yet when documents array is empty and user can list docs", async () => {
    mockPermissions = ["inventory.read", "documents.read"];
    mockApiFetch
      .mockResolvedValueOnce(costResponse)
      .mockResolvedValueOnce(entriesResponse)
      .mockResolvedValueOnce({ data: [] });
    render(<VehicleCostsAndDocumentsCard vehicleId={vehicleId} />);
    await waitFor(() => {
      expect(screen.getByText("Documents")).toBeInTheDocument();
    });
    expect(screen.getByText("No documents yet.")).toBeInTheDocument();
  });

  it("calls signed-url with fileObjectId when View document is clicked", async () => {
    const fileObjectId = "f1000000-0000-0000-0000-000000000001";
    mockPermissions = ["inventory.read", "documents.read", "documents.write"];
    mockApiFetch.mockReset();
    mockApiFetch
      .mockResolvedValueOnce(costResponse)
      .mockResolvedValueOnce(entriesResponse)
      .mockResolvedValueOnce({
        data: [
          {
            id: "doc-1",
            vehicleId,
            costEntryId: null,
            fileObjectId,
            kind: "invoice",
            createdAt: "2025-01-15T12:00:00.000Z",
            createdByUserId: "u1",
            file: { id: fileObjectId, filename: "invoice.pdf", mimeType: "application/pdf", sizeBytes: 1024 },
          },
        ],
      })
      .mockResolvedValueOnce({ url: "https://signed.example.com/doc", expiresAt: new Date().toISOString() });
    render(<VehicleCostsAndDocumentsCard vehicleId={vehicleId} />);
    await waitFor(() => {
      expect(screen.getByText("invoice.pdf")).toBeInTheDocument();
    });
    const viewBtn = screen.getByRole("button", { name: /open invoice\.pdf/i });
    await userEvent.click(viewBtn);
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        `/api/files/signed-url?fileId=${encodeURIComponent(fileObjectId)}`
      );
    });
  });

  it("refetches cost and entries after successful add cost entry", async () => {
    mockPermissions = ["inventory.read", "inventory.write"];
    mockApiFetch
      .mockResolvedValueOnce(costResponse)
      .mockResolvedValueOnce(entriesResponse)
      .mockResolvedValueOnce({ id: "new-entry", vehicleId, category: "transport", amountCents: "50000", occurredAt: new Date().toISOString(), vendorName: null, memo: null, createdByUserId: "u1", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      .mockResolvedValueOnce(costResponse)
      .mockResolvedValueOnce(entriesResponse);
    render(<VehicleCostsAndDocumentsCard vehicleId={vehicleId} />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /add cost entry/i })).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole("button", { name: /add cost entry/i }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^add$/i })).toBeInTheDocument();
    });
    const amountInput = screen.getByLabelText(/amount/i);
    await userEvent.clear(amountInput);
    await userEvent.type(amountInput, "500");
    await userEvent.click(screen.getByRole("button", { name: /^add$/i }));
    await waitFor(() => {
      const postCalls = mockApiFetch.mock.calls.filter(
        (c) => Array.isArray(c) && (c[1] as RequestInit)?.method === "POST" && (c[0] as string).includes("cost-entries")
      );
      const getCostCalls = mockApiFetch.mock.calls.filter((c) => Array.isArray(c) && (c[0] as string) === `/api/inventory/${vehicleId}/cost`);
      const getEntriesCalls = mockApiFetch.mock.calls.filter((c) => Array.isArray(c) && (c[0] as string) === `/api/inventory/${vehicleId}/cost-entries` && (c[1] as RequestInit)?.method !== "POST");
      expect(postCalls.length).toBeGreaterThanOrEqual(1);
      expect(getCostCalls.length).toBeGreaterThanOrEqual(2);
      expect(getEntriesCalls.length).toBeGreaterThanOrEqual(2);
    }, { timeout: 3000 });
  });
});
