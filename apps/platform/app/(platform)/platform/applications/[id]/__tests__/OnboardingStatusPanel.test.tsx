/**
 * Onboarding Status Panel: renders mocked API response; no email or tokens displayed.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { OnboardingStatusPanel, type OnboardingStatusData } from "../OnboardingStatusPanel";

const mockData: OnboardingStatusData = {
  applicationId: "550e8400-e29b-41d4-a716-446655440000",
  applicationStatus: "APPROVED",
  platformDealershipId: "660e8400-e29b-41d4-a716-446655440001",
  platformDealershipStatus: "PROVISIONED",
  mapping: {
    dealerDealershipId: "770e8400-e29b-41d4-a716-446655440002",
    provisionedAt: "2025-03-01T12:00:00.000Z",
  },
  ownerInvite: { status: "PENDING" },
  ownerJoined: false,
  nextAction: "WAIT_FOR_ACCEPT",
  timeline: [
    { eventType: "APPLICATION_APPROVED", createdAt: "2025-03-01T10:00:00.000Z" },
    { eventType: "DEALERSHIP_PROVISIONED", createdAt: "2025-03-01T12:00:00.000Z" },
    { eventType: "OWNER_INVITE_SENT", createdAt: "2025-03-01T14:00:00.000Z" },
  ],
};

describe("OnboardingStatusPanel", () => {
  it("renders null when data is null", () => {
    const { container } = render(<OnboardingStatusPanel data={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders onboarding status with mocked response", () => {
    render(<OnboardingStatusPanel data={mockData} />);
    expect(screen.getByText("Onboarding Status")).toBeInTheDocument();
    expect(screen.getByText("APPROVED")).toBeInTheDocument();
    expect(screen.getByText("PROVISIONED")).toBeInTheDocument();
    expect(screen.getByText(/Owner Invite:/)).toBeInTheDocument();
    expect(screen.getByText("PENDING")).toBeInTheDocument();
    expect(screen.getByText("No")).toBeInTheDocument();
    expect(screen.getByText("WAIT_FOR_ACCEPT")).toBeInTheDocument();
  });

  it("renders timeline with eventType and createdAt only (no email/tokens)", () => {
    render(<OnboardingStatusPanel data={mockData} />);
    expect(screen.getByText("APPLICATION_APPROVED")).toBeInTheDocument();
    expect(screen.getByText("DEALERSHIP_PROVISIONED")).toBeInTheDocument();
    expect(screen.getByText("OWNER_INVITE_SENT")).toBeInTheDocument();
    expect(screen.getByText(/Timeline/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/@|token|email/i);
  });
});
