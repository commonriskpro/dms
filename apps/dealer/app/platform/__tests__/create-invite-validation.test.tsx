/**
 * Create invite form: empty or invalid email does not submit (button disabled or validation).
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PlatformInvitesPage from "../invites/page";

const mockApiFetch = vi.fn();
const mockAddToast = vi.fn();

vi.mock("@/contexts/session-context", () => ({
  useSession: () => ({
    state: { status: "authenticated" as const },
    platformAdmin: { isAdmin: true },
  }),
}));

vi.mock("@/lib/client/http", () => ({
  apiFetch: (url: string, init?: RequestInit) => mockApiFetch(url, init),
}));

vi.mock("@/components/toast", () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

function setupMocks() {
  mockApiFetch.mockImplementation((url: string) => {
    if (url.includes("limit=500") && url.includes("dealerships"))
      return Promise.resolve({ data: [{ id: "d1", name: "Dealer 1" }] });
    if (url.includes("/invites"))
      return Promise.resolve({ data: [], meta: { total: 0, limit: 20, offset: 0 } });
    if (url.includes("/roles"))
      return Promise.resolve({ data: [{ id: "r1", name: "Sales" }] });
    return Promise.reject(new Error(`Unexpected URL: ${url}`));
  });
}

describe("Create invite form validation", () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
    mockAddToast.mockReset();
    setupMocks();
  });

  it("Create invite button is disabled when email is empty", async () => {
    render(<PlatformInvitesPage />);
    const [selectDealership] = await screen.findAllByRole("combobox", { name: /Select dealership/i });
    fireEvent.change(selectDealership, { target: { value: "d1" } });
    await waitFor(() => {
      expect(screen.queryByText(/Something went wrong/i)).not.toBeInTheDocument();
    });
    const createInviteBtns = screen.getAllByRole("button", { name: /Create invite/i });
    fireEvent.click(createInviteBtns[0]);
    const createSubmit = await screen.findByRole("button", { name: /^Create$/ });
    expect(createSubmit).toBeDisabled();
    expect(mockApiFetch).not.toHaveBeenCalledWith(
      expect.stringContaining("/invites"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("Create invite button is disabled when role is not selected", async () => {
    render(<PlatformInvitesPage />);
    const [selectDealership] = await screen.findAllByRole("combobox", { name: /Select dealership/i });
    fireEvent.change(selectDealership, { target: { value: "d1" } });
    await waitFor(() => {
      expect(screen.queryByText(/Something went wrong/i)).not.toBeInTheDocument();
    });
    const createInviteBtns = screen.getAllByRole("button", { name: /Create invite/i });
    fireEvent.click(createInviteBtns[0]);
    const emailInput = await screen.findByLabelText(/^Email$/i);
    fireEvent.change(emailInput, { target: { value: "not-an-email" } });
    const createSubmit = screen.getByRole("button", { name: /^Create$/ });
    expect(createSubmit).toBeDisabled();
  });
});
