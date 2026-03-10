/**
 * Jobs page: "Queue worker run" button visible only when crm.write; hidden when !crm.write.
 */
import React from "react";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { JobsPage } from "../JobsPage";

let mockPermissions: string[] = [];
const mockFetch = jest.fn();

jest.mock("@/contexts/session-context", () => ({
  useSession: () => ({
    hasPermission: (key: string) => mockPermissions.includes(key),
  }),
}));

jest.mock("@/components/toast", () => ({
  useToast: () => ({ addToast: jest.fn() }),
}));

describe("JobsPage: queue worker button gating", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve({ data: [], meta: { total: 0, limit: 25, offset: 0 } }),
    });
    ((globalThis as unknown as { fetch: typeof mockFetch }).fetch = mockFetch);
  });

  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  it("Queue worker run button is hidden when user has crm.read but not crm.write", async () => {
    mockPermissions = ["crm.read"];
    render(<JobsPage />);
    await waitFor(() => {
      expect(mockFetch.mock.calls.some((c: [string]) => String(c[0]).includes("/api/crm/jobs"))).toBe(true);
    });
    const runButton = screen.queryByRole("button", { name: /queue worker run/i });
    expect(runButton).toBeNull();
  });

  it("Queue worker run button is present when user has crm.read and crm.write", async () => {
    mockPermissions = ["crm.read", "crm.write"];
    render(<JobsPage />);
    await waitFor(() => {
      expect(mockFetch.mock.calls.some((c: [string]) => String(c[0]).includes("/api/crm/jobs"))).toBe(true);
    });
    const runButton = screen.getByRole("button", { name: /queue worker run/i });
    expect(runButton).toBeInTheDocument();
  });
});
