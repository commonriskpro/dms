/**
 * Topbar: shows lifecycle status badge when activeDealership and lifecycleStatus are present.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { Topbar } from "../topbar";

const mockReplace = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

const mockUseSession = jest.fn();
jest.mock("@/contexts/session-context", () => ({
  useSession: () => mockUseSession(),
}));

jest.mock("@/modules/search/ui/GlobalSearch", () => ({
  GlobalSearch: () => <div data-testid="global-search">Search</div>,
}));

describe("Topbar lifecycle badge", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSession.mockReturnValue({
      user: { email: "u@test.com", fullName: "User" },
      activeDealership: { id: "d1", name: "Test Dealership" },
      lifecycleStatus: "ACTIVE",
      hasPermission: jest.fn(() => true),
    });
  });

  it("renders dealership name and ACTIVE badge when lifecycleStatus is ACTIVE", () => {
    render(<Topbar />);
    expect(screen.getByText("Test Dealership")).toBeInTheDocument();
    expect(screen.getByText("ACTIVE")).toBeInTheDocument();
  });

  it("renders SUSPENDED badge when lifecycleStatus is SUSPENDED", () => {
    mockUseSession.mockReturnValue({
      user: { email: "u@test.com", fullName: "User" },
      activeDealership: { id: "d1", name: "Test Dealership" },
      lifecycleStatus: "SUSPENDED",
      hasPermission: jest.fn(() => true),
    });
    render(<Topbar />);
    expect(screen.getByText("SUSPENDED")).toBeInTheDocument();
  });

  it("renders CLOSED badge when lifecycleStatus is CLOSED", () => {
    mockUseSession.mockReturnValue({
      user: { email: "u@test.com", fullName: "User" },
      activeDealership: { id: "d1", name: "Test Dealership" },
      lifecycleStatus: "CLOSED",
      hasPermission: jest.fn(() => true),
    });
    render(<Topbar />);
    expect(screen.getByText("CLOSED")).toBeInTheDocument();
  });
});
