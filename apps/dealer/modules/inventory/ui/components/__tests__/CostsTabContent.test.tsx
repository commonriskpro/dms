/**
 * Vehicle Costs Tab Hybrid UI — CostsTabContent: permission gate, loading, loaded content,
 * Acquisition Summary / Cost Totals / Cost Ledger, document rail visibility.
 */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

const mockDetectDocumentKindFromFile = jest.fn();
jest.mock("@/modules/inventory/ui/document-kind-detection", () => ({
  detectDocumentKindFromFile: (...args: unknown[]) => mockDetectDocumentKindFromFile(...args),
  getDocumentKindLabel: (kind: string) =>
    ({
      invoice: "Invoice",
      receipt: "Receipt",
      bill_of_sale: "Bill of sale",
      title_doc: "Title doc",
      other: "Other",
    })[kind] ?? kind,
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
    mockDetectDocumentKindFromFile.mockReset();
    mockPermissions = ["inventory.read"];
    URL.createObjectURL = jest.fn(() => "blob:test");
    URL.revokeObjectURL = jest.fn();
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
    expect(screen.getByLabelText("Search cost entries")).toBeInTheDocument();
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
      expect(screen.getByLabelText("Search cost entries")).toBeInTheDocument();
    });
    expect(screen.getAllByText("Auction Co").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("$10,000.00").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("$12,750.00").length).toBeGreaterThanOrEqual(1);
  });

  it("shows Add Cost button only when user has inventory.write", async () => {
    render(<CostsTabContent vehicleId={vehicleId} />);
    await waitFor(() => {
      expect(screen.getByLabelText("Search cost entries")).toBeInTheDocument();
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
      expect(screen.getByLabelText("Search cost entries")).toBeInTheDocument();
    });
    expect(screen.getByText("No cost entries yet")).toBeInTheDocument();
  });

  it("auto-detects, switches active files, and saves multiple add-cost documents in staged mode", async () => {
    mockPermissions = ["inventory.read", "inventory.write", "documents.read", "documents.write"];
    mockDetectDocumentKindFromFile
      .mockResolvedValueOnce({
        kind: "invoice",
        confidence: 0.92,
        source: "ocr",
      })
      .mockResolvedValueOnce({
        kind: "receipt",
        confidence: 0.88,
        source: "pdf-text",
      });
    const handleDataChange = jest.fn();
    const { container } = render(<CostsTabContent onDataChange={handleDataChange} />);

    fireEvent.click(screen.getByRole("button", { name: /add cost/i }));
    fireEvent.change(screen.getByPlaceholderText(/repair, certification/i), {
      target: { value: "Alignment" },
    });
    fireEvent.change(screen.getByPlaceholderText(/\$0\.00/i), {
      target: { value: "125.50" },
    });

    const fileInput = container.querySelector("#cost-doc-upload") as HTMLInputElement;
    const files = [
      new File(["invoice"], "scan.pdf", { type: "application/pdf" }),
      new File(["receipt"], "receipt.png", { type: "image/png" }),
    ];
    fireEvent.change(fileInput, { target: { files } });

    await waitFor(() => {
      expect(screen.getAllByText("scan.pdf").length).toBeGreaterThan(0);
      expect(screen.getAllByText("receipt.png").length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole("button", { name: /scan\.pdf/i })[0]);
    expect(screen.getByText(/Detected as Invoice via ocr/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/detected kind/i)).toHaveValue("invoice");

    fireEvent.change(screen.getByLabelText(/detected kind/i), {
      target: { value: "title_doc" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save cost/i }));

    await waitFor(() => {
      const latestCall = handleDataChange.mock.calls.at(-1)?.[0];
      expect(latestCall.documents).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ kind: "title_doc" }),
          expect.objectContaining({ kind: "receipt" }),
        ])
      );
    });
  });
});
