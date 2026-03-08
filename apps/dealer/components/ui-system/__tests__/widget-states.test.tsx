import * as React from "react";
import { render, screen } from "@testing-library/react";
import { Widget } from "@/components/ui-system/widgets";

describe("widget primitive", () => {
  it("renders title, subtitle, and action", () => {
    render(
      <Widget
        title="Inventory Intelligence"
        subtitle="Price-to-market and aging indicators"
        action={<button type="button">Open</button>}
      >
        <div>Widget body</div>
      </Widget>
    );

    expect(screen.getByText("Inventory Intelligence")).toBeInTheDocument();
    expect(screen.getByText("Price-to-market and aging indicators")).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.getByText("Widget body")).toBeInTheDocument();
  });
});
