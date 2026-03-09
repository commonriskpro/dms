/**
 * SessionsBlock: renders sessions, single-session message, revoke all others with confirm.
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionsBlock } from "../SessionsBlock";

const mockConfirm = jest.fn();
const mockAddToast = jest.fn();
jest.mock("@/components/ui/confirm-dialog", () => ({
  useConfirm: () => mockConfirm,
}));
jest.mock("@/components/toast", () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

const mockApiFetch = jest.fn();
jest.mock("@/lib/client/http", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

describe("SessionsBlock", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders current session and revoke button after load", async () => {
    mockApiFetch
      .mockResolvedValueOnce({
        sessions: [
          { id: "s1", current: true, createdAt: "2025-01-01T12:00:00Z", lastActiveAt: "2025-01-01T12:00:00Z" },
        ],
      });
    render(<SessionsBlock />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /revoke all other sessions/i })).toBeInTheDocument();
    });
    expect(screen.getByText("This device")).toBeInTheDocument();
    expect(screen.getByText("Current")).toBeInTheDocument();
  });

  it("shows only-signed-in-on-this-device when single session", async () => {
    mockApiFetch.mockResolvedValueOnce({
      sessions: [{ id: "s1", current: true, createdAt: "2025-01-01T12:00:00Z" }],
    });
    render(<SessionsBlock />);
    await waitFor(() => {
      expect(screen.getByText(/you're only signed in on this device/i)).toBeInTheDocument();
    });
  });

  it("calls revoke API and refreshes when user confirms", async () => {
    mockApiFetch
      .mockResolvedValueOnce({
        sessions: [{ id: "s1", current: true, createdAt: "2025-01-01T12:00:00Z" }],
      })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        sessions: [{ id: "s1", current: true, createdAt: "2025-01-01T12:00:00Z" }],
      });
    mockConfirm.mockResolvedValueOnce(true);
    const user = userEvent.setup();
    render(<SessionsBlock />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /revoke all other sessions/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /revoke all other sessions/i }));
    await waitFor(() => {
      expect(mockConfirm).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Revoke all other sessions",
          variant: "danger",
        })
      );
    });
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/api/auth/sessions/revoke",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ revokeAllOthers: true }),
        })
      );
    });
    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith("success", "Other sessions have been revoked.");
    });
  });

  it("does not call revoke API when user cancels confirm", async () => {
    mockApiFetch.mockResolvedValueOnce({
      sessions: [{ id: "s1", current: true, createdAt: "2025-01-01T12:00:00Z" }],
    });
    mockConfirm.mockResolvedValueOnce(false);
    const user = userEvent.setup();
    render(<SessionsBlock />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /revoke all other sessions/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /revoke all other sessions/i }));
    await waitFor(() => {
      expect(mockConfirm).toHaveBeenCalled();
    });
    expect(mockApiFetch).toHaveBeenCalledTimes(1);
  });
});
