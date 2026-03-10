/**
 * Error handling: JobsPage POST /api/crm/jobs/run returns 403 -> "Not allowed"; 429 -> rate limited toast.
 */
import React from "react";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";
import { JobsPage } from "../JobsPage";
import { HttpError } from "@/lib/client/http";

let mockPermissions: string[] = [];
const mockAddToast = jest.fn();
const listResponse = () =>
  new Response(
    JSON.stringify({ data: [], meta: { total: 0, limit: 25, offset: 0 } }),
    { status: 200, headers: { "content-type": "application/json" } }
  );

function createFetchMock(runStatus: number) {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : (input as URL).href;
    const method = (init?.method || "GET").toUpperCase();
    if (method === "POST" && url.includes("/api/crm/jobs/run")) {
      return new Response(
        JSON.stringify({ error: { message: "Forbidden" } }),
        { status: runStatus, headers: { "content-type": "application/json" } }
      );
    }
    if (url.includes("/api/crm/jobs")) return listResponse();
    return new Response("", { status: 404 });
  };
}

jest.mock("@/contexts/session-context", () => ({
  useSession: () => ({
    hasPermission: (key: string) => mockPermissions.includes(key),
  }),
}));

jest.mock("@/components/toast", () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

describe("JobsPage: error handling", () => {
  beforeEach(() => {
    mockAddToast.mockReset();
    mockPermissions = ["crm.read", "crm.write"];
  });

  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  it("403 from POST /api/crm/jobs/run triggers toast with Not allowed", async () => {
    jest.spyOn(global, "fetch").mockImplementation(createFetchMock(403) as typeof fetch);
    render(<JobsPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /queue worker run/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /queue worker run/i }));
    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith("error", "Not allowed to run worker");
    });
  });

  it("429 from POST /api/crm/jobs/run triggers rate limited toast", async () => {
    jest.spyOn(global, "fetch").mockImplementation(createFetchMock(429) as typeof fetch);
    render(<JobsPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /queue worker run/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /queue worker run/i }));
    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith("error", "Rate limited — try again soon");
    });
  });
});

describe("HttpError and toast message", () => {
  it("HttpError 403 has status property for JobsPage handler", () => {
    const err = new HttpError(403, "Forbidden");
    expect(err.status).toBe(403);
  });
});
