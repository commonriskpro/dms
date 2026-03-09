/**
 * Get-started: nextAction / case logic renders correct message (CASE 1 Select dealership, CASE 2 pending invite, CASE 3 no dealership).
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { GetStartedClient } from "../GetStartedClient";

type OnboardingStatus = {
  membershipsCount: number;
  hasActiveDealership: boolean;
  pendingInvitesCount: number;
  nextAction: "CHECK_EMAIL_FOR_INVITE" | "SELECT_DEALERSHIP" | "NONE";
  onboardingComplete?: boolean;
  onboardingCurrentStep?: number;
};

const mockRouterReplace = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockRouterReplace, refresh: jest.fn() }),
}));

const mockRefetch = jest.fn();
jest.mock("@/contexts/session-context", () => ({
  useSession: () => ({ refetch: mockRefetch, state: { status: "authenticated" } }),
}));

jest.mock("@/components/toast", () => ({
  useToast: () => ({ addToast: jest.fn() }),
}));

jest.mock("@/lib/client/http", () => ({
  apiFetch: jest.fn(),
}));

jest.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div data-testid="app-shell">{children}</div>,
}));

jest.mock("../OnboardingFlowClient", () => ({
  OnboardingFlowClient: ({ initialStep }: { initialStep: number }) => (
    <div data-testid="onboarding-flow">Onboarding flow (step {initialStep})</div>
  ),
}));

describe("GetStartedClient nextAction logic", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders Select your dealership when membershipsCount > 0 and !hasActiveDealership (CASE 1)", () => {
    const status: OnboardingStatus = {
      membershipsCount: 2,
      hasActiveDealership: false,
      pendingInvitesCount: 0,
      nextAction: "SELECT_DEALERSHIP",
    };
    render(
      <GetStartedClient
        initialOnboardingStatus={status}
        initialDealerships={[
          { id: "d1", name: "Dealer A" },
          { id: "d2", name: "Dealer B" },
        ]}
      />
    );
    expect(screen.getByText("Select your dealership")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dealer A" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dealer B" })).toBeInTheDocument();
  });

  it("renders pending invite message and Open invite link when membershipsCount === 0 and pendingInvitesCount > 0 (CASE 2)", () => {
    const status: OnboardingStatus = {
      membershipsCount: 0,
      hasActiveDealership: false,
      pendingInvitesCount: 1,
      nextAction: "CHECK_EMAIL_FOR_INVITE",
    };
    render(
      <GetStartedClient
        initialOnboardingStatus={status}
        initialDealerships={[]}
      />
    );
    expect(screen.getByText(/You have a pending dealership invite. Check your email to join./)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Open invite link/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/accept-invite");
  });

  it("renders No dealership linked yet when membershipsCount === 0 and pendingInvitesCount === 0 (CASE 3)", () => {
    const status: OnboardingStatus = {
      membershipsCount: 0,
      hasActiveDealership: false,
      pendingInvitesCount: 0,
      nextAction: "NONE",
    };
    render(
      <GetStartedClient
        initialOnboardingStatus={status}
        initialDealerships={[]}
      />
    );
    expect(screen.getByText("No dealership linked yet")).toBeInTheDocument();
    expect(screen.getByText(/DEV ONLY/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Link me as Owner/i })).toBeInTheDocument();
  });

  it("renders onboarding flow when has active dealership and onboarding not complete", () => {
    const status: OnboardingStatus = {
      membershipsCount: 1,
      hasActiveDealership: true,
      pendingInvitesCount: 0,
      nextAction: "NONE",
    };
    render(
      <GetStartedClient
        initialOnboardingStatus={status}
        initialDealerships={[{ id: "d1", name: "My Dealer" }]}
      />
    );
    expect(screen.getByTestId("onboarding-flow")).toBeInTheDocument();
    expect(screen.getByText(/Onboarding flow \(step 1\)/)).toBeInTheDocument();
  });

  it("shows Redirecting to dashboard and calls router.replace when has active dealership and onboarding complete", () => {
    const status: OnboardingStatus = {
      membershipsCount: 1,
      hasActiveDealership: true,
      pendingInvitesCount: 0,
      nextAction: "NONE",
      onboardingComplete: true,
      onboardingCurrentStep: 6,
    };
    render(
      <GetStartedClient
        initialOnboardingStatus={status}
        initialDealerships={[{ id: "d1", name: "My Dealer" }]}
      />
    );
    expect(screen.getByText(/Redirecting to dashboard/)).toBeInTheDocument();
    expect(mockRouterReplace).toHaveBeenCalledWith("/dashboard");
  });
});
