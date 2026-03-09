/**
 * Vehicle Detail — VehicleDetailContent: tab row present;
 * Overview (costs) is first and default; Details shows card stack.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { VehicleDetailContent } from "../VehicleDetailContent";
import type { VehicleDetailResponse } from "../types";

jest.mock("@/contexts/session-context", () => ({
  useSession: () => ({ hasPermission: () => true }),
}));

jest.mock("@/components/toast", () => ({
  useToast: () => ({ addToast: jest.fn() }),
}));

jest.mock("../components/CostsTabContent", () => ({
  CostsTabContent: ({ vehicleId }: { vehicleId: string }) => (
    <div data-testid="costs-tab-content" data-vehicle-id={vehicleId}>
      Costs tab
    </div>
  ),
}));

const minimalVehicle: VehicleDetailResponse = {
  id: "v1000000-0000-0000-0000-000000000001",
  dealershipId: "d1000000-0000-0000-0000-000000000001",
  vin: "1HGBH41JXMN109186",
  year: 2021,
  make: "Ford",
  model: "F-150",
  trim: null,
  stockNumber: "STK1",
  mileage: 10000,
  color: "White",
  status: "AVAILABLE",
  locationId: null,
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

describe("VehicleDetailContent (Overview = costs default)", () => {
  it("shows Overview (costs) content when activeTab is costs", () => {
    render(
      <VehicleDetailContent
        vehicle={minimalVehicle}
        photoUrls={{}}
        vehicleId={minimalVehicle.id}
        activeTab="costs"
      />
    );
    expect(screen.getByTestId("costs-tab-content")).toBeInTheDocument();
    expect(screen.getByText("Costs tab")).toBeInTheDocument();
  });

  it("passes vehicleId to CostsTabContent when activeTab is costs", () => {
    const vehicleId = minimalVehicle.id;
    render(
      <VehicleDetailContent
        vehicle={minimalVehicle}
        photoUrls={{}}
        vehicleId={vehicleId}
        activeTab="costs"
      />
    );
    const costsContent = screen.getByTestId("costs-tab-content");
    expect(costsContent).toHaveAttribute("data-vehicle-id", vehicleId);
  });
});
