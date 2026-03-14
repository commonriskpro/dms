/**
 * Home page landing: last-workspace → role-aware default → fallback.
 * Tests redirect behavior for authenticated users with various permissions and stored last workspace.
 */
import React from "react";
import { render } from "@testing-library/react";
import Home from "../page";
import { setLastWorkspace } from "@/lib/last-workspace";

const mockReplace = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

function createSessionMock(overrides: {
  activeDealership?: { id: string; name: string } | null;
  permissions?: string[];
} = {}) {
  const {
    activeDealership = { id: "dealer-1", name: "Test" },
    permissions = [],
  } = overrides;
  const hasPermission = (key: string) => permissions.includes(key);
  return {
    state: { status: "authenticated" as const },
    activeDealership,
    hasPermission,
    permissions,
  };
}

jest.mock("@/contexts/session-context", () => ({
  useSession: jest.fn(),
}));

import { useSession } from "@/contexts/session-context";

describe("Home page: authenticated landing", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
  });

  it("redirects to /get-started when no active dealership", () => {
    (useSession as jest.Mock).mockReturnValue(
      createSessionMock({ activeDealership: null, permissions: ["crm.read"] })
    );
    render(<Home />);
    expect(mockReplace).toHaveBeenCalledWith("/get-started");
  });

  it("first-time user with no remembered workspace lands on role-aware default (sales)", () => {
    (useSession as jest.Mock).mockReturnValue(
      createSessionMock({ permissions: ["crm.read"] })
    );
    render(<Home />);
    expect(mockReplace).toHaveBeenCalledWith("/sales");
  });

  it("first-time user with inventory only lands on /inventory", () => {
    (useSession as jest.Mock).mockReturnValue(
      createSessionMock({ permissions: ["inventory.read"] })
    );
    render(<Home />);
    expect(mockReplace).toHaveBeenCalledWith("/inventory");
  });

  it("remembered workspace is used when user still has permission", () => {
    setLastWorkspace("dealer-1", "inventory");
    (useSession as jest.Mock).mockReturnValue(
      createSessionMock({ permissions: ["crm.read", "inventory.read"] })
    );
    render(<Home />);
    expect(mockReplace).toHaveBeenCalledWith("/inventory");
  });

  it("remembered workspace is ignored when user no longer has permission", () => {
    setLastWorkspace("dealer-1", "inventory");
    (useSession as jest.Mock).mockReturnValue(
      createSessionMock({ permissions: ["crm.read"] })
    );
    render(<Home />);
    expect(mockReplace).toHaveBeenCalledWith("/sales");
  });

  it("mixed-role user with remembered manager lands on /dashboard", () => {
    setLastWorkspace("dealer-1", "manager");
    (useSession as jest.Mock).mockReturnValue(
      createSessionMock({
        permissions: ["crm.read", "dashboard.read", "inventory.read"],
      })
    );
    render(<Home />);
    expect(mockReplace).toHaveBeenCalledWith("/dashboard");
  });

  it("safe fallback to /dashboard when only dashboard.read", () => {
    (useSession as jest.Mock).mockReturnValue(
      createSessionMock({ permissions: ["dashboard.read"] })
    );
    render(<Home />);
    expect(mockReplace).toHaveBeenCalledWith("/dashboard");
  });

  it("fallback to /files when only documents.read", () => {
    (useSession as jest.Mock).mockReturnValue(
      createSessionMock({ permissions: ["documents.read"] })
    );
    render(<Home />);
    expect(mockReplace).toHaveBeenCalledWith("/files");
  });

  it("admin-only user lands on admin workspace", () => {
    (useSession as jest.Mock).mockReturnValue(
      createSessionMock({
        permissions: ["admin.dealership.read"],
      })
    );
    render(<Home />);
    expect(mockReplace).toHaveBeenCalledWith("/admin/dealership");
  });
});
