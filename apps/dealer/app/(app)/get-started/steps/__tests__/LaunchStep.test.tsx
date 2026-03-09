/**
 * LaunchStep: Go to dashboard and I'll finish later call correct handlers.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LaunchStep } from "../LaunchStep";

describe("LaunchStep", () => {
  const onBack = jest.fn();
  const onFinish = jest.fn();
  const onFinishLater = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders You're all set and next-action links", () => {
    render(
      <LaunchStep
        onBack={onBack}
        onFinish={onFinish}
        onFinishLater={onFinishLater}
        isLoading={false}
      />
    );
    expect(screen.getByText(/You're all set/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Add a vehicle/i })).toHaveAttribute("href", "/inventory/new");
    expect(screen.getByRole("link", { name: /Add a customer/i })).toHaveAttribute("href", "/customers");
    expect(screen.getByRole("link", { name: /Start a deal/i })).toHaveAttribute("href", "/deals");
    expect(screen.getByRole("link", { name: /Invite team members/i })).toHaveAttribute("href", "/admin/users");
  });

  it("Go to dashboard calls onFinish", async () => {
    render(
      <LaunchStep
        onBack={onBack}
        onFinish={onFinish}
        onFinishLater={onFinishLater}
        isLoading={false}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /Go to dashboard/i }));
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinishLater).not.toHaveBeenCalled();
  });

  it("I'll finish later calls onFinishLater", async () => {
    render(
      <LaunchStep
        onBack={onBack}
        onFinish={onFinish}
        onFinishLater={onFinishLater}
        isLoading={false}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /I'll finish later/i }));
    expect(onFinishLater).toHaveBeenCalledTimes(1);
    expect(onFinish).not.toHaveBeenCalled();
  });

  it("Back calls onBack", async () => {
    render(
      <LaunchStep
        onBack={onBack}
        onFinish={onFinish}
        onFinishLater={onFinishLater}
        isLoading={false}
      />
    );
    const backButtons = screen.getAllByRole("button", { name: /Back/i });
    await userEvent.click(backButtons[backButtons.length - 1]);
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
