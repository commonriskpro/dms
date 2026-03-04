/**
 * Accept-invite page: shows correct message and CTAs for INVITE_EXPIRED,
 * INVITE_ALREADY_ACCEPTED, and for success with alreadyHadMembership.
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { HttpError } from "@/lib/client/http";
import AcceptInvitePage from "../accept-invite/page";

const mockReplace = jest.fn();
const mockRefetch = jest.fn();
const mockUseSearchParams = jest.fn();
const mockApiFetch = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, refresh: jest.fn() }),
  useSearchParams: () => mockUseSearchParams(),
}));

jest.mock("@/lib/client/http", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/client/http")>();
  return {
    ...actual,
    apiFetch: (...args: unknown[]) => mockApiFetch(...args),
  };
});

jest.mock("@/contexts/session-context", () => ({
  useSession: () => ({
    state: { status: "authenticated" as const },
    refetch: mockRefetch,
    hasPermission: () => false,
  }),
}));

describe("Accept-invite page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSearchParams.mockReturnValue(new URLSearchParams());
  });

  it("shows paste input when no token in URL", async () => {
    render(<AcceptInvitePage />);
    await waitFor(() => {
      expect(screen.getByLabelText(/paste invite link or token/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /resolve invite/i })).toBeInTheDocument();
  });

  it("shows Invite expired message and CTAs when resolve returns INVITE_EXPIRED", async () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams("token=abc123"));
    mockApiFetch.mockRejectedValue(
      new HttpError(410, "This invite has expired", "INVITE_EXPIRED")
    );

    render(<AcceptInvitePage />);

    await waitFor(() => {
      expect(screen.getByText(/invite expired/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: /request a new invite/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /go to login/i })).toBeInTheDocument();
  });

  it("shows Invite not found message and Paste again when resolve returns 404 INVITE_NOT_FOUND", async () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams("token=bad"));
    mockApiFetch.mockRejectedValue(
      new HttpError(404, "Invite not found", "INVITE_NOT_FOUND")
    );

    render(<AcceptInvitePage />);

    await waitFor(() => {
      expect(screen.getByText(/invite not found/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /paste link again/i })).toBeInTheDocument();
    const loginLinks = screen.getAllByRole("link", { name: /go to login/i });
    expect(loginLinks.length).toBeGreaterThanOrEqual(1);
  });

  it("shows Invite already used message and Go to login when resolve returns INVITE_ALREADY_ACCEPTED", async () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams("token=used"));
    mockApiFetch.mockRejectedValue(
      new HttpError(410, "This invite has already been used", "INVITE_ALREADY_ACCEPTED")
    );

    render(<AcceptInvitePage />);

    await waitFor(() => {
      expect(screen.getByText(/invite already used/i)).toBeInTheDocument();
    });
    const loginLinks = screen.getAllByRole("link", { name: /go to login/i });
    expect(loginLinks.length).toBeGreaterThanOrEqual(1);
    expect(loginLinks[0]).toHaveAttribute("href", "/login");
  });

  it("shows You already have access and Go to dashboard when accept returns alreadyHadMembership", async () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams("token=valid"));
    mockApiFetch
      .mockResolvedValueOnce({
        data: {
          inviteId: "inv-1",
          dealershipName: "Test Dealership",
          roleName: "Manager",
        },
      })
      .mockResolvedValueOnce({
        data: {
          membershipId: "mem-1",
          dealershipId: "dlr-1",
          alreadyHadMembership: true,
        },
      });

    render(<AcceptInvitePage />);

    await waitFor(() => {
      expect(screen.getByText(/you're invited to join/i)).toBeInTheDocument();
    });
    const acceptBtn = screen.getByRole("button", { name: /^accept$/i });
    expect(acceptBtn).toBeInTheDocument();

    acceptBtn.click();

    await waitFor(() => {
      expect(screen.getByText(/you already have access to this dealership/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: /go to dashboard/i })).toHaveAttribute("href", "/dashboard");
  });
});
