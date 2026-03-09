import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CostLedgerCard } from "../components/CostLedgerCard";
import type { VehicleCostEntryResponse } from "../types";

const mockEntry: VehicleCostEntryResponse = {
  id: "e1",
  vehicleId: "v1",
  category: "acquisition",
  amountCents: "2500000",
  vendorId: null,
  vendorName: "Auction House",
  vendorDisplayName: "Auction House",
  vendorType: null,
  occurredAt: "2025-06-15T00:00:00.000Z",
  memo: "Vehicle purchased at auction",
  createdByUserId: "u1",
  createdAt: "2025-06-15T00:00:00.000Z",
  updatedAt: "2025-06-15T00:00:00.000Z",
};

const emptyDocMap = new Map();

describe("CostLedgerCard", () => {
  it("renders entries in the table", () => {
    render(
      <CostLedgerCard
        entries={[mockEntry]}
        docsByEntryId={emptyDocMap}
        canWrite={true}
        onAddCost={jest.fn()}
        onEditEntry={jest.fn()}
        onDeleteEntry={jest.fn()}
      />
    );
    expect(screen.getAllByText("Auction House").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Vehicle purchased at auction")).toBeInTheDocument();
  });

  it("renders Add Cost button when canWrite is true", () => {
    render(
      <CostLedgerCard
        entries={[mockEntry]}
        docsByEntryId={emptyDocMap}
        canWrite={true}
        onAddCost={jest.fn()}
        onEditEntry={jest.fn()}
        onDeleteEntry={jest.fn()}
      />
    );
    expect(screen.getByLabelText("Add cost entry")).toBeInTheDocument();
  });

  it("hides Add Cost button when canWrite is false", () => {
    render(
      <CostLedgerCard
        entries={[mockEntry]}
        docsByEntryId={emptyDocMap}
        canWrite={false}
        onAddCost={jest.fn()}
        onEditEntry={jest.fn()}
        onDeleteEntry={jest.fn()}
      />
    );
    expect(screen.queryByLabelText("Add cost entry")).not.toBeInTheDocument();
  });

  it("calls onAddCost when Add Cost is clicked", async () => {
    const onAddCost = jest.fn();
    render(
      <CostLedgerCard
        entries={[mockEntry]}
        docsByEntryId={emptyDocMap}
        canWrite={true}
        onAddCost={onAddCost}
        onEditEntry={jest.fn()}
        onDeleteEntry={jest.fn()}
      />
    );
    await userEvent.click(screen.getByLabelText("Add cost entry"));
    expect(onAddCost).toHaveBeenCalledTimes(1);
  });

  it("renders export button that is enabled when entries exist", () => {
    render(
      <CostLedgerCard
        entries={[mockEntry]}
        docsByEntryId={emptyDocMap}
        canWrite={false}
        onAddCost={jest.fn()}
        onEditEntry={jest.fn()}
        onDeleteEntry={jest.fn()}
      />
    );
    const exportBtn = screen.getByLabelText("Export cost ledger as CSV");
    expect(exportBtn).toBeInTheDocument();
    expect(exportBtn).not.toBeDisabled();
  });

  it("disables export button when no entries match filter", () => {
    render(
      <CostLedgerCard
        entries={[]}
        docsByEntryId={emptyDocMap}
        canWrite={false}
        onAddCost={jest.fn()}
        onEditEntry={jest.fn()}
        onDeleteEntry={jest.fn()}
      />
    );
    const exportBtn = screen.getByLabelText("Export cost ledger as CSV");
    expect(exportBtn).toBeDisabled();
  });

  it("shows entry count summary in footer", () => {
    render(
      <CostLedgerCard
        entries={[mockEntry]}
        docsByEntryId={emptyDocMap}
        canWrite={false}
        onAddCost={jest.fn()}
        onEditEntry={jest.fn()}
        onDeleteEntry={jest.fn()}
      />
    );
    expect(screen.getByText("Showing 1 of 1 entries")).toBeInTheDocument();
  });

  it("shows empty state when no entries exist", () => {
    render(
      <CostLedgerCard
        entries={[]}
        docsByEntryId={emptyDocMap}
        canWrite={false}
        onAddCost={jest.fn()}
        onEditEntry={jest.fn()}
        onDeleteEntry={jest.fn()}
      />
    );
    expect(screen.getByText("No cost entries yet.")).toBeInTheDocument();
  });

  it("filters entries by search term", async () => {
    const entries: VehicleCostEntryResponse[] = [
      mockEntry,
      { ...mockEntry, id: "e2", category: "transport", vendorName: "Shipper Co", memo: "Transport fee" },
    ];
    render(
      <CostLedgerCard
        entries={entries}
        docsByEntryId={emptyDocMap}
        canWrite={false}
        onAddCost={jest.fn()}
        onEditEntry={jest.fn()}
        onDeleteEntry={jest.fn()}
      />
    );
    expect(screen.getByText("Showing 2 of 2 entries")).toBeInTheDocument();
    const searchInput = screen.getByLabelText("Search cost entries");
    await userEvent.type(searchInput, "Shipper");
    expect(screen.getByText("Showing 1 of 2 entries")).toBeInTheDocument();
  });
});
