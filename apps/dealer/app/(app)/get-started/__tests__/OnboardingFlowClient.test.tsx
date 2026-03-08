/**
 * OnboardingFlowClient: step rail, step navigation, save/skip/complete, launch/finish-later.
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OnboardingFlowClient } from "../OnboardingFlowClient";

const mockRouterReplace = jest.fn();
const mockRouterRefresh = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockRouterReplace, refresh: mockRouterRefresh }),
}));

const mockAddToast = jest.fn();
jest.mock("@/components/toast", () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

const mockApiFetch = jest.fn();
jest.mock("@/lib/client/http", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

function makeState(overrides: Record<string, unknown> = {}) {
  return {
    id: "ob-1",
    dealershipId: "d1",
    currentStep: 1,
    completedSteps: [],
    skippedSteps: [],
    inventoryPathChosen: undefined,
    isComplete: false,
    completedAt: undefined,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("OnboardingFlowClient", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/onboarding") {
        const body = init?.body ? JSON.parse(init.body as string) : {};
        return Promise.resolve({
          onboarding: makeState(
            body.completeStep !== undefined ? { currentStep: body.completeStep + 1 } : undefined
          ),
        });
      }
      if (url === "/api/admin/dealership" && init?.method !== "PATCH") {
        return Promise.resolve({ dealership: { name: "Test Dealer" }, locations: [] });
      }
      return Promise.reject(new Error("Unexpected URL"));
    });
  });

  it("shows loading then step rail and step 1 content after GET onboarding", async () => {
    render(<OnboardingFlowClient initialStep={1} />);
    expect(screen.getByText(/Loading your setup/)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("Set up your dealership")).toBeInTheDocument();
    });
    expect(screen.getByText(/Step 1 of 6/)).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: undefined })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText(/Dealership name/i)).toBeInTheDocument();
    });
  });

  it("shows error and Retry when GET onboarding fails", async () => {
    mockApiFetch.mockRejectedValueOnce(new Error("Network error"));
    render(<OnboardingFlowClient initialStep={1} />);
    await waitFor(() => {
      expect(screen.getByText(/Failed to load onboarding|Network error/)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /Retry/i })).toBeInTheDocument();
  });

  it("shows Redirecting and calls router.replace when state.isComplete is true", async () => {
    mockApiFetch.mockResolvedValueOnce({
      onboarding: makeState({ isComplete: true, currentStep: 6 }),
    });
    render(<OnboardingFlowClient initialStep={6} />);
    await waitFor(() => {
      expect(screen.getByText(/Redirecting to dashboard/)).toBeInTheDocument();
    });
    expect(mockRouterReplace).toHaveBeenCalledWith("/dashboard");
  });

  it("step 2 shows Invite later and Back", async () => {
    mockApiFetch.mockResolvedValueOnce({ onboarding: makeState({ currentStep: 2 }) });
    render(<OnboardingFlowClient initialStep={2} />);
    await waitFor(() => {
      expect(screen.getByText(/Step 2 of 6/)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /Invite later/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Back/i })).toBeInTheDocument();
  });

  it("step 6 shows Go to dashboard and I'll finish later", async () => {
    mockApiFetch.mockResolvedValueOnce({ onboarding: makeState({ currentStep: 6 }) });
    render(<OnboardingFlowClient initialStep={6} />);
    await waitFor(() => {
      expect(screen.getByText(/Step 6 of 6/)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /Go to dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /I'll finish later/i })).toBeInTheDocument();
  });

  it("I'll finish later calls router.replace without PATCH", async () => {
    mockApiFetch.mockResolvedValueOnce({ onboarding: makeState({ currentStep: 6 }) });
    render(<OnboardingFlowClient initialStep={6} />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /I'll finish later/i })).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole("button", { name: /I'll finish later/i }));
    expect(mockRouterReplace).toHaveBeenCalledWith("/dashboard");
    expect(mockApiFetch).toHaveBeenCalledTimes(1);
  });

  it("skip step triggers PATCH and updates to next step", async () => {
    mockApiFetch
      .mockResolvedValueOnce({ onboarding: makeState({ currentStep: 2 }) })
      .mockResolvedValueOnce({
        onboarding: makeState({ currentStep: 3, skippedSteps: [2] }),
      });
    render(<OnboardingFlowClient initialStep={2} />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Invite later/i })).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole("button", { name: /Invite later/i }));
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/api/onboarding",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ skipStep: 2 }),
        })
      );
    });
  });
});
