import { render, cleanup } from "@testing-library/react";
import * as React from "react";
import { DealerLifecycleProvider, useDealerLifecycle } from "../dealer-lifecycle-context";

const mockUseSession = jest.fn();
jest.mock("@/contexts/session-context", () => ({
  useSession: () => mockUseSession(),
}));

function Consumer() {
  const lifecycle = useDealerLifecycle();
  return (
    <div data-testid="consumer">
      <span data-status={lifecycle.status} />
      <span data-active={String(lifecycle.isActive)} />
      <span data-suspended={String(lifecycle.isSuspended)} />
      <span data-closed={String(lifecycle.isClosed)} />
      {lifecycle.closedDealership && (
        <span data-testid="closed-name">{lifecycle.closedDealership.name}</span>
      )}
    </div>
  );
}

describe("DealerLifecycleProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cleanup();
    mockUseSession.mockReturnValue({
      state: { status: "authenticated" },
      activeDealership: { id: "d1", name: "Test Dealer" },
      lifecycleStatus: "ACTIVE",
      closedDealership: null,
    });
  });

  it("exposes ACTIVE when lifecycleStatus is ACTIVE", () => {
    const { container } = render(
      <DealerLifecycleProvider>
        <Consumer />
      </DealerLifecycleProvider>
    );
    const el = container.querySelector("[data-testid='consumer']")!;
    expect(el.querySelector("[data-status]")?.getAttribute("data-status")).toBe("ACTIVE");
    expect(el.querySelector("[data-active]")?.getAttribute("data-active")).toBe("true");
    expect(el.querySelector("[data-suspended]")?.getAttribute("data-suspended")).toBe("false");
    expect(el.querySelector("[data-closed]")?.getAttribute("data-closed")).toBe("false");
  });

  it("exposes SUSPENDED when lifecycleStatus is SUSPENDED", () => {
    mockUseSession.mockReturnValue({
      state: { status: "authenticated" },
      activeDealership: { id: "d1", name: "Test Dealer" },
      lifecycleStatus: "SUSPENDED",
      closedDealership: null,
    });
    const { container } = render(
      <DealerLifecycleProvider>
        <Consumer />
      </DealerLifecycleProvider>
    );
    const el = container.querySelector("[data-testid='consumer']")!;
    expect(el.querySelector("[data-status]")?.getAttribute("data-status")).toBe("SUSPENDED");
    expect(el.querySelector("[data-active]")?.getAttribute("data-active")).toBe("false");
    expect(el.querySelector("[data-suspended]")?.getAttribute("data-suspended")).toBe("true");
    expect(el.querySelector("[data-closed]")?.getAttribute("data-closed")).toBe("false");
  });

  it("exposes CLOSED and closedDealership when lifecycleStatus is CLOSED", () => {
    mockUseSession.mockReturnValue({
      state: { status: "authenticated" },
      activeDealership: null,
      lifecycleStatus: "CLOSED",
      closedDealership: { id: "d1", name: "Closed Dealer" },
    });
    const { container } = render(
      <DealerLifecycleProvider>
        <Consumer />
      </DealerLifecycleProvider>
    );
    const el = container.querySelector("[data-testid='consumer']")!;
    expect(el.querySelector("[data-status]")?.getAttribute("data-status")).toBe("CLOSED");
    expect(el.querySelector("[data-active]")?.getAttribute("data-active")).toBe("false");
    expect(el.querySelector("[data-suspended]")?.getAttribute("data-suspended")).toBe("false");
    expect(el.querySelector("[data-closed]")?.getAttribute("data-closed")).toBe("true");
    expect(el.querySelector("[data-testid='closed-name']")?.textContent).toBe("Closed Dealer");
  });
});
