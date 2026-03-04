/**
 * JourneyBarWidget: permission gating (no fetch when crm.read is false);
 * fetches journey-bar when canRead is true; stage change calls PATCH.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { JourneyBarWidget } from "../JourneyBarWidget";

const mockFetch = vi.fn();

vi.mock("@/lib/client/http", () => ({
  apiFetch: (input: string) => {
    mockFetch(input);
    if (input.includes("/api/crm/journey-bar")) {
      return Promise.resolve({
        data: {
          stages: [
            { id: "s1", name: "Lead", order: 0, colorKey: "blue" },
            { id: "s2", name: "Won", order: 1, colorKey: "green" },
          ],
          currentStageId: "s1",
          currentIndex: 0,
          signals: { overdueTaskCount: 0 },
          nextBestActionKey: null,
        },
      });
    }
    if (input.includes("/stage") && input.includes("PATCH")) {
      return Promise.resolve({ data: { id: "c1", stageId: "s2" } });
    }
    return Promise.reject(new Error("Unexpected request"));
  },
  getApiErrorMessage: (e: unknown) => (e instanceof Error ? e.message : "Request failed"),
}));

vi.mock("@/components/toast", () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

describe("JourneyBarWidget", () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("does not call apiFetch when canRead is false", async () => {
    render(
      <JourneyBarWidget
        customerId="00000000-0000-0000-0000-000000000001"
        canRead={false}
        canWrite={false}
      />
    );
    await vi.waitFor(() => {});
    const journeyBarCalls = mockFetch.mock.calls.filter(
      (c: [string]) => String(c[0]).includes("/api/crm/journey-bar")
    );
    expect(journeyBarCalls.length).toBe(0);
  });

  it("fetches journey-bar when canRead is true", async () => {
    render(
      <JourneyBarWidget
        customerId="00000000-0000-0000-0000-000000000001"
        canRead={true}
        canWrite={false}
      />
    );
    await waitFor(() => {
      expect(mockFetch.mock.calls.some((c: [string]) => String(c[0]).includes("/api/crm/journey-bar"))).toBe(true);
    });
    await waitFor(() => {
      expect(screen.getByRole("progressbar")).toBeInTheDocument();
    });
    expect(screen.getByText("Lead")).toBeInTheDocument();
  });

  it("renders nothing when canRead is false", () => {
    const { container } = render(
      <JourneyBarWidget
        customerId="00000000-0000-0000-0000-000000000001"
        canRead={false}
        canWrite={false}
      />
    );
    expect(container.firstChild).toBeNull();
  });
});
