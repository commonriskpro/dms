/**
 * DealershipInfoStep: load dealership name, save and continue calls onNext after PATCH.
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DealershipInfoStep } from "../DealershipInfoStep";

const mockApiFetch = jest.fn();
jest.mock("@/lib/client/http", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

jest.mock("@/components/toast", () => ({
  useToast: () => ({ addToast: jest.fn() }),
}));

describe("DealershipInfoStep", () => {
  const onNext = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockApiFetch.mockResolvedValue({
      dealership: { name: "Main Street Auto" },
      locations: [],
    });
  });

  it("shows loading then dealership name from GET /api/admin/dealership", async () => {
    render(
      <DealershipInfoStep onNext={onNext} onSkip={undefined} isLoading={false} />
    );
    expect(screen.getByText(/Loading dealership info/)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText(/Dealership name/i)).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue("Main Street Auto")).toBeInTheDocument();
    expect(mockApiFetch).toHaveBeenCalledWith("/api/admin/dealership");
  });

  it("Save and continue is disabled when name is empty", async () => {
    mockApiFetch.mockResolvedValue({
      dealership: { name: "" },
      locations: [],
    });
    render(
      <DealershipInfoStep onNext={onNext} onSkip={undefined} isLoading={false} />
    );
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Save and continue/i })).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /Save and continue/i })).toBeDisabled();
  });

  it("Save and continue calls PATCH then onNext when name is non-empty", async () => {
    mockApiFetch
      .mockResolvedValueOnce({
        dealership: { name: "My Dealer" },
        locations: [],
      })
      .mockResolvedValueOnce(undefined);
    render(
      <DealershipInfoStep onNext={onNext} onSkip={undefined} isLoading={false} />
    );
    await waitFor(() => {
      expect(screen.getByDisplayValue("My Dealer")).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole("button", { name: /Save and continue/i }));
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/api/admin/dealership",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ name: "My Dealer" }),
        })
      );
    });
    expect(onNext).toHaveBeenCalled();
  });
});
