/**
 * ApplyFormClient: step navigation, save/submit behavior, lifecycle state rendering
 * (draft, submitted, approved, rejected).
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ApplyFormClient } from "../ApplyFormClient";

const mockReplace = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
}));

const mockApiFetch = jest.fn();
jest.mock("@/lib/client/http", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

const applicationId = "a1000000-0000-0000-0000-000000000001";

function draftApp(overrides?: { status?: string; submittedAt?: string | null }) {
  return {
    applicationId,
    status: "draft",
    source: "public_apply",
    ownerEmail: "owner@example.com",
    submittedAt: null as string | null,
    profile: {
      businessInfo: {},
      ownerInfo: {},
      primaryContact: {},
      additionalLocations: [],
      pricingPackageInterest: {},
      acknowledgments: {},
    },
    ...overrides,
  };
}

describe("ApplyFormClient", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiFetch.mockResolvedValue(draftApp());
  });

  it("shows loading then form when GET returns draft", async () => {
    render(<ApplyFormClient applicationId={applicationId} />);
    await waitFor(() => {
      expect(screen.getByText("Dealer application")).toBeInTheDocument();
    });
    expect(screen.getByText(/Step 1 of 6/)).toBeInTheDocument();
    expect(screen.getByText("Business information")).toBeInTheDocument();
    expect(mockApiFetch).toHaveBeenCalledWith(`/api/apply/${applicationId}`);
  });

  it("shows Application submitted when status is submitted", async () => {
    mockApiFetch.mockResolvedValue(draftApp({ status: "submitted", submittedAt: "2025-03-01T12:00:00Z" }));
    render(<ApplyFormClient applicationId={applicationId} />);
    await waitFor(() => {
      expect(screen.getByText("Application submitted")).toBeInTheDocument();
    });
    expect(screen.getByText(/Status: submitted/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Back to apply/ })).toHaveAttribute("href", "/apply");
  });

  it("shows Application submitted when status is approved", async () => {
    mockApiFetch.mockResolvedValue(draftApp({ status: "approved" }));
    render(<ApplyFormClient applicationId={applicationId} />);
    await waitFor(() => {
      expect(screen.getByText("Application submitted")).toBeInTheDocument();
    });
    expect(screen.getByText(/Status: approved/)).toBeInTheDocument();
  });

  it("shows Application submitted when status is rejected", async () => {
    mockApiFetch.mockResolvedValue(draftApp({ status: "rejected" }));
    render(<ApplyFormClient applicationId={applicationId} />);
    await waitFor(() => {
      expect(screen.getByText("Application submitted")).toBeInTheDocument();
    });
    expect(screen.getByText(/Status: rejected/)).toBeInTheDocument();
  });

  it("shows Application submitted when status is under_review", async () => {
    mockApiFetch.mockResolvedValue(draftApp({ status: "under_review" }));
    render(<ApplyFormClient applicationId={applicationId} />);
    await waitFor(() => {
      expect(screen.getByText("Application submitted")).toBeInTheDocument();
    });
    expect(screen.getByText(/Status: under_review/)).toBeInTheDocument();
  });

  it("Back button decreases step", async () => {
    render(<ApplyFormClient applicationId={applicationId} />);
    await waitFor(() => {
      expect(screen.getByText("Business information")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Save & next" }));
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        `/api/apply/${applicationId}`,
        expect.objectContaining({ method: "PATCH" })
      );
    });
    await waitFor(() => {
      expect(screen.getByText(/Step 2 of 6/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    await waitFor(() => {
      expect(screen.getByText(/Step 1 of 6/)).toBeInTheDocument();
    });
  });

  it("Submit application calls PATCH then POST submit then replaces to success", async () => {
    const stepTitles = [
      "Business information",
      "Business owner",
      "Primary contact",
      "Additional locations",
      "Pricing & package interest",
      "Review & submit",
    ];
    render(<ApplyFormClient applicationId={applicationId} />);
    await waitFor(() => {
      expect(screen.getByText("Business information")).toBeInTheDocument();
    });
    for (let i = 0; i < 5; i++) {
      mockApiFetch.mockResolvedValue(draftApp());
      fireEvent.click(screen.getByRole("button", { name: "Save & next" }));
      await waitFor(() => {
        expect(screen.getByText(stepTitles[i + 1]!)).toBeInTheDocument();
      });
    }
    mockApiFetch
      .mockResolvedValueOnce(undefined) // PATCH
      .mockResolvedValueOnce({ applicationId, status: "submitted", submittedAt: new Date().toISOString() }); // submit
    fireEvent.click(screen.getByRole("button", { name: "Submit application" }));
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/apply/success");
    });
  });

  it("shows error and Back to apply link when GET fails", async () => {
    mockApiFetch.mockRejectedValue(new Error("Application not found"));
    render(<ApplyFormClient applicationId={applicationId} />);
    await waitFor(() => {
      expect(screen.getByText("Application not found")).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: /Back to apply/ })).toHaveAttribute("href", "/apply");
  });
});
