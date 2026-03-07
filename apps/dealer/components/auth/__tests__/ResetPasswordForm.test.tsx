/**
 * ResetPasswordForm: expired state, form with recovery hash (mocked), validation, success.
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResetPasswordForm } from "../ResetPasswordForm";

const mockSetSession = jest.fn();
jest.mock("@/lib/supabase/browser", () => ({
  createClient: () => ({ auth: { setSession: mockSetSession } }),
}));

const originalFetch = globalThis.fetch;

describe("ResetPasswordForm", () => {
  beforeEach(() => {
    globalThis.fetch = jest.fn();
    mockSetSession.mockReset();
    window.location.hash = "";
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("shows expired message when hash has no recovery params", async () => {
    window.location.hash = "";
    render(<ResetPasswordForm />);
    await waitFor(() => {
      expect(screen.getByText(/this link has expired or was already used/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: /request new reset link/i })).toHaveAttribute("href", "/forgot-password");
    expect(screen.getByRole("link", { name: /back to sign in/i })).toHaveAttribute("href", "/login");
  });

  it("shows form when recovery params in hash and setSession succeeds", async () => {
    window.location.hash = "type=recovery&access_token=at&refresh_token=rt";
    mockSetSession.mockResolvedValue({ data: {}, error: null });
    render(<ResetPasswordForm />);
    await waitFor(() => {
      expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /update password/i })).toBeInTheDocument();
  });

  it("shows password mismatch error on submit when passwords do not match", async () => {
    window.location.hash = "type=recovery&access_token=at&refresh_token=rt";
    mockSetSession.mockResolvedValue({ data: {}, error: null });
    const user = userEvent.setup();
    render(<ResetPasswordForm />);
    await waitFor(() => {
      expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
    });
    await user.type(screen.getByLabelText(/new password/i), "NewPass123!@#");
    await user.type(screen.getByLabelText(/confirm password/i), "OtherPass456!");
    await user.click(screen.getByRole("button", { name: /update password/i }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Passwords do not match");
    });
  });

  it("shows success state after successful reset", async () => {
    window.location.hash = "type=recovery&access_token=at&refresh_token=rt";
    mockSetSession.mockResolvedValue({ data: {}, error: null });
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    const user = userEvent.setup();
    render(<ResetPasswordForm />);
    await waitFor(() => {
      expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
    });
    await user.type(screen.getByLabelText(/new password/i), "NewSecurePass123!@#");
    await user.type(screen.getByLabelText(/confirm password/i), "NewSecurePass123!@#");
    await user.click(screen.getByRole("button", { name: /update password/i }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /password updated/i })).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/login");
  });

  it("shows generic expired/error when API returns error", async () => {
    window.location.hash = "type=recovery&access_token=at&refresh_token=rt";
    mockSetSession.mockResolvedValue({ data: {}, error: null });
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: { message: "This link has expired or was already used." } }),
    });
    const user = userEvent.setup();
    render(<ResetPasswordForm />);
    await waitFor(() => {
      expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
    });
    await user.type(screen.getByLabelText(/new password/i), "NewPass123!@#");
    await user.type(screen.getByLabelText(/confirm password/i), "NewPass123!@#");
    await user.click(screen.getByRole("button", { name: /update password/i }));
    await waitFor(() => {
      expect(screen.getByText(/this link has expired or was already used/i)).toBeInTheDocument();
    });
  });
});
