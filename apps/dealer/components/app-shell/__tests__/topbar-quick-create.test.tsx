import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

describe("Topbar Quick Create & Controls", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSession.mockReturnValue({
      user: { email: "u@test.com", fullName: "Test User" },
      activeDealership: { id: "d1", name: "Test Dealership" },
      lifecycleStatus: null,
      hasPermission: jest.fn(() => true),
    });
  });

  it("renders Quick Create trigger button", () => {
    render(<Topbar />);
    expect(screen.getByLabelText("Quick create menu")).toBeInTheDocument();
  });

  it("renders Sign Out button with handler", () => {
    render(<Topbar />);
    const signOut = screen.getByText("Sign out");
    expect(signOut).toBeInTheDocument();
    expect(signOut.tagName).toBe("BUTTON");
  });

  it("renders theme toggle button", () => {
    render(<Topbar />);
    const toggle = screen.getByLabelText(/Switch to (light|dark) mode/);
    expect(toggle).toBeInTheDocument();
  });

  it("renders notifications bell as disabled", () => {
    render(<Topbar />);
    const bell = screen.getByLabelText("Notifications (coming soon)");
    expect(bell).toBeDisabled();
  });

  it("hides Quick Create items when user lacks permissions", () => {
    mockUseSession.mockReturnValue({
      user: { email: "u@test.com", fullName: "Test User" },
      activeDealership: { id: "d1", name: "Test Dealership" },
      lifecycleStatus: null,
      hasPermission: jest.fn(() => false),
    });
    render(<Topbar />);
    expect(screen.queryByText("Add Vehicle")).not.toBeInTheDocument();
    expect(screen.queryByText("Add Lead")).not.toBeInTheDocument();
    expect(screen.queryByText("New Deal")).not.toBeInTheDocument();
  });

  it("renders user initials from fullName", () => {
    render(<Topbar />);
    expect(screen.getByText("TE")).toBeInTheDocument();
  });
});
