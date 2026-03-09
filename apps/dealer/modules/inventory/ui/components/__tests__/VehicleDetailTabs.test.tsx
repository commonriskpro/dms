/**
 * Vehicle Costs Tab Hybrid UI — VehicleDetailTabs: tab labels, active state, onTabChange.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VehicleDetailTabs, type VehicleDetailTabId } from "../VehicleDetailTabs";

describe("VehicleDetailTabs", () => {
  it("renders all tab labels", () => {
    const onTabChange = jest.fn();
    render(
      <VehicleDetailTabs activeTab="costs" onTabChange={onTabChange} />
    );
    expect(screen.getByRole("navigation", { name: /vehicle detail sections/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Details$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Cost$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Media$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Pricing$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Recon$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^History$/ })).toBeInTheDocument();
  });

  it("marks active tab with aria-current", () => {
    render(
      <VehicleDetailTabs activeTab="costs" onTabChange={jest.fn()} />
    );
    const costButton = screen.getByRole("button", { name: /^Cost$/, current: "page" });
    expect(costButton).toHaveAttribute("aria-current", "page");
  });

  it("calls onTabChange with tab id when a tab is clicked", async () => {
    const user = userEvent.setup();
    const onTabChange = jest.fn();
    render(
      <VehicleDetailTabs activeTab="overview" onTabChange={onTabChange} />
    );
    await user.click(screen.getByRole("button", { name: /^Cost$/ }));
    expect(onTabChange).toHaveBeenCalledTimes(1);
    expect(onTabChange).toHaveBeenCalledWith("costs");
  });
});
