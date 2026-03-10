/**
 * Customers UI smoke tests: rendering states and permission gates.
 */
import React from "react";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { CustomersListPage } from "../CustomersListPage";
import { CustomerDetailPage } from "../DetailPage";
import { RoadToSale } from "../RoadToSale";
import { ActivityTimeline } from "../ActivityTimeline";
import { TasksPanel } from "../TasksPanel";
import { DashboardCustomersWidget } from "../DashboardCustomersWidget";

let mockPermissions: string[] = [];
const mockFetch = jest.fn();

jest.mock("@/contexts/session-context", () => ({
  useSession: () => ({
    hasPermission: (key: string) => mockPermissions.includes(key),
    user: null,
    activeDealership: null,
  }),
}));

jest.mock("@/components/toast", () => ({
  useToast: () => ({ addToast: jest.fn() }),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

describe("Customers UI: no access when !customers.read", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockPermissions = [];
    ((globalThis as unknown as { fetch: typeof mockFetch }).fetch = mockFetch);
  });

  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  it("CustomersListPage shows no-access message when !customers.read", () => {
    const { container } = render(<CustomersListPage />);
    expect(container.textContent).toMatch(/don.?t have access to customers/i);
  });

  it("CustomerDetailPage shows no-access message when !customers.read", () => {
    const { container } = render(
      <CustomerDetailPage id="00000000-0000-0000-0000-000000000001" />
    );
    expect(container.textContent).toMatch(/don.?t have access to this customer/i);
  });

  it("DashboardCustomersWidget renders nothing when !customers.read", () => {
    const { container } = render(<DashboardCustomersWidget canRead={false} />);
    expect(container.firstChild).toBeNull();
  });
});

describe("Customers UI: RoadToSale renders for each stage", () => {
  it("renders without crashing for LEAD", () => {
    const { container } = render(<RoadToSale currentStage="LEAD" />);
    expect(container.textContent).toMatch(/Lead/i);
  });

  it("renders without crashing for SOLD", () => {
    const { container } = render(<RoadToSale currentStage="SOLD" />);
    expect(container.textContent).toMatch(/Sold/i);
  });

  it("renders without crashing for INACTIVE", () => {
    const { container } = render(<RoadToSale currentStage="INACTIVE" />);
    expect(container.textContent).toMatch(/Lost/i);
  });
});

describe("Customers UI: ActivityTimeline and TasksPanel with canRead false", () => {
  it("ActivityTimeline renders null when !canRead", () => {
    const { container } = render(
      <ActivityTimeline customerId="00000000-0000-0000-0000-000000000001" canRead={false} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("TasksPanel renders null when !canRead", () => {
    const { container } = render(
      <TasksPanel customerId="00000000-0000-0000-0000-000000000001" canRead={false} />
    );
    expect(container.firstChild).toBeNull();
  });
});

describe("Customers UI: list page with customers.read and empty data", () => {
  const emptyCustomersPayload = () =>
    new Response(
      JSON.stringify({ data: [], meta: { total: 0, limit: 25, offset: 0 } }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  beforeEach(() => {
    mockFetch.mockReset();
    mockPermissions = ["customers.read"];
    mockFetch.mockImplementation(() => Promise.resolve(emptyCustomersPayload()));
    ((globalThis as unknown as { fetch: typeof mockFetch }).fetch = mockFetch);
  });

  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  it("CustomersListPage shows empty state after load", async () => {
    render(<CustomersListPage />);
    await waitFor(() => {
      expect(mockFetch.mock.calls.some((c: [string]) => String(c[0]).includes("/api/customers"))).toBe(true);
    });
    await waitFor(() => {
      expect(screen.getByText((content) => content.includes("No customers"))).toBeInTheDocument();
    });
  });
});
