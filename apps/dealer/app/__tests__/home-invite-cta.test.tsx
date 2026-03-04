/**
 * Home page: when unauthenticated, shows "Have an invite? Accept it" CTA linking to /accept-invite.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "../page";

const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

vi.mock("@/contexts/session-context", () => ({
  useSession: () => ({
    state: { status: "unauthenticated" as const },
    activeDealership: null,
    hasPermission: () => false,
  }),
}));

describe("Home page: unauthenticated invite CTA", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders 'Have an invite? Accept it' link with href /accept-invite", () => {
    render(<Home />);
    const link = screen.getByRole("link", { name: /have an invite\? accept it/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/accept-invite");
  });
});
