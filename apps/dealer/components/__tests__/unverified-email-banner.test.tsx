/**
 * UnverifiedEmailBanner: shows when authenticated and !emailVerified and !isSupportSession; resend and dismiss.
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UnverifiedEmailBanner } from "../unverified-email-banner";

const mockRefetch = jest.fn();
const mockUseSession = jest.fn();
jest.mock("@/contexts/session-context", () => ({
  useSession: () => mockUseSession(),
}));

const originalFetch = globalThis.fetch;

describe("UnverifiedEmailBanner", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    globalThis.fetch = jest.fn();
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("renders nothing when authenticated and email is verified", () => {
    mockUseSession.mockReturnValue({
      state: { status: "authenticated" },
      emailVerified: true,
      isSupportSession: false,
      refetch: mockRefetch,
    });
    const { container } = render(<UnverifiedEmailBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when support session", () => {
    mockUseSession.mockReturnValue({
      state: { status: "authenticated" },
      emailVerified: false,
      isSupportSession: true,
      refetch: mockRefetch,
    });
    const { container } = render(<UnverifiedEmailBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("renders banner when authenticated, not support session, and email not verified", () => {
    mockUseSession.mockReturnValue({
      state: { status: "authenticated" },
      emailVerified: false,
      isSupportSession: false,
      refetch: mockRefetch,
    });
    render(<UnverifiedEmailBanner />);
    expect(screen.getByText(/verify your email to secure your account/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /resend verification email/i })).toBeInTheDocument();
  });

  it("calls resend API and shows success message", async () => {
    mockUseSession.mockReturnValue({
      state: { status: "authenticated" },
      emailVerified: false,
      isSupportSession: false,
      refetch: mockRefetch,
    });
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: "If your email is not yet verified, you will receive a verification link." }),
    });
    const user = userEvent.setup();
    render(<UnverifiedEmailBanner />);
    await user.click(screen.getByRole("button", { name: /resend verification email/i }));
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith("/api/auth/verify-email/resend", { method: "POST" });
    });
    await waitFor(() => {
      expect(screen.getByText(/you will receive a verification link/i)).toBeInTheDocument();
    });
    expect(mockRefetch).toHaveBeenCalled();
  });

  it("dismisses banner when dismiss button clicked", async () => {
    mockUseSession.mockReturnValue({
      state: { status: "authenticated" },
      emailVerified: false,
      isSupportSession: false,
      refetch: mockRefetch,
    });
    const user = userEvent.setup();
    render(<UnverifiedEmailBanner />);
    expect(screen.getByText(/verify your email to secure your account/i)).toBeInTheDocument();
    const dismiss = screen.getByRole("button", { name: /dismiss banner/i });
    await user.click(dismiss);
    expect(screen.queryByText(/verify your email to secure your account/i)).not.toBeInTheDocument();
  });
});
