import * as React from "react";
import { render, screen } from "@testing-library/react";
import { CustomerHeader, VehicleHeader } from "@/components/ui-system/entities";

describe("entity header primitives", () => {
  it("renders customer header metadata and status", () => {
    render(
      <CustomerHeader
        name="Jane Doe"
        status="ACTIVE"
        subtitle="Created today"
        meta={[{ label: "Primary phone", value: "(555) 555-1212" }]}
      />
    );

    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("ACTIVE")).toBeInTheDocument();
    expect(screen.getByText("Primary phone:")).toBeInTheDocument();
    expect(screen.getByText("(555) 555-1212")).toBeInTheDocument();
  });

  it("renders vehicle header with status chip", () => {
    render(
      <VehicleHeader title="2024 Demo Car" status="AVAILABLE" subtitle="In stock" />
    );

    expect(screen.getByText("2024 Demo Car")).toBeInTheDocument();
    expect(screen.getByText("AVAILABLE")).toBeInTheDocument();
    expect(screen.getByText("In stock")).toBeInTheDocument();
  });
});
