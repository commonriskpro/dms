/**
 * Customer Lead Action Strip: XSS safety and permission visibility.
 * Spec: docs/specs/sprint4-customer-lead-action-strip-spec.md
 */
import React from "react";
import { render, screen, fireEvent, within, cleanup, waitFor } from "@testing-library/react";
import { LeadActionStrip, CustomerDetailPage } from "../DetailPage";
import type { CustomerDetail } from "@/lib/types/customers";

jest.mock("@/contexts/session-context", () => ({
  useSession: () => ({
    hasPermission: (key: string) =>
      key === "customers.read" || key === "customers.write" || key === "admin.memberships.read",
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

const baseCustomer: CustomerDetail = {
  id: "00000000-0000-0000-0000-000000000001",
  dealershipId: "00000000-0000-0000-0000-000000000002",
  name: "Test Customer",
  isDraft: false,
  leadSource: null,
  status: "LEAD",
  assignedTo: null,
  addressLine1: null,
  addressLine2: null,
  city: null,
  region: null,
  postalCode: null,
  country: null,
  tags: [],
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
  phones: [{ id: "p1", kind: null, value: "+15551234567", isPrimary: true }],
  emails: [{ id: "e1", kind: null, value: "test@example.com", isPrimary: true }],
  assignedToProfile: null,
};

const noop = () => {};

function getToolbar() {
  const toolbars = screen.getAllByRole("toolbar", { name: "Lead actions" });
  return toolbars[0];
}

describe("LeadActionStrip: permission visibility", () => {
  afterEach(() => cleanup());
  it("with only customers.read: shows Call and Email only; hides SMS, Schedule Appointment, Add Task, Disposition", () => {
    render(
      <LeadActionStrip
        customer={baseCustomer}
        canRead={true}
        canWrite={false}
        onOpenSms={noop}
        onOpenAppointment={noop}
        onOpenAddTask={noop}
        onOpenDisposition={noop}
      />
    );
    const toolbar = getToolbar();
    expect(within(toolbar).getByRole("link", { name: /phone call/i })).toBeInTheDocument();
    expect(within(toolbar).getByRole("link", { name: /open email client/i })).toBeInTheDocument();
    expect(within(toolbar).queryByRole("button", { name: /send sms/i })).not.toBeInTheDocument();
    expect(within(toolbar).queryByRole("button", { name: /schedule appointment/i })).not.toBeInTheDocument();
    expect(within(toolbar).queryByRole("button", { name: /add task/i })).not.toBeInTheDocument();
    expect(within(toolbar).queryByRole("button", { name: /disposition/i })).not.toBeInTheDocument();
  });

  it("with customers.write: shows all six actions (Call, SMS, Email, Schedule Appointment, Add Task, Disposition)", () => {
    render(
      <LeadActionStrip
        customer={baseCustomer}
        customerId={baseCustomer.id}
        canRead={true}
        canWrite={true}
        canReadCrm={true}
        onOpenSms={noop}
        onOpenAppointment={noop}
        onOpenAddTask={noop}
        onOpenDisposition={noop}
      />
    );
    const toolbar = getToolbar();
    expect(within(toolbar).getByRole("link", { name: /phone call/i })).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: /send sms/i })).toBeInTheDocument();
    expect(within(toolbar).getByRole("link", { name: /open email client/i })).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: /schedule appointment/i })).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: /add task/i })).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: /disposition/i })).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: /open inbox/i })).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: /open opportunity/i })).toBeInTheDocument();
  });

  it("with customers.read only and no phone: does not show Call link", () => {
    const noPhone = { ...baseCustomer, phones: [] };
    render(
      <LeadActionStrip
        customer={noPhone}
        canRead={true}
        canWrite={false}
        onOpenSms={noop}
        onOpenAppointment={noop}
        onOpenAddTask={noop}
        onOpenDisposition={noop}
      />
    );
    const toolbar = getToolbar();
    expect(within(toolbar).queryByRole("link", { name: /phone call/i })).not.toBeInTheDocument();
  });

  it("with customers.read only and no email: does not show Email link", () => {
    const noEmail = { ...baseCustomer, emails: [] };
    render(
      <LeadActionStrip
        customer={noEmail}
        canRead={true}
        canWrite={false}
        onOpenSms={noop}
        onOpenAppointment={noop}
        onOpenAddTask={noop}
        onOpenDisposition={noop}
      />
    );
    const toolbar = getToolbar();
    expect(within(toolbar).queryByRole("link", { name: /open email client/i })).not.toBeInTheDocument();
  });
});

describe("LeadActionStrip: XSS safety", () => {
  afterEach(() => cleanup());
  it("strip with malicious customer name does not create script or img elements", () => {
    const malicious = '<script>alert(1)</script>';
    const customerWithMaliciousName = { ...baseCustomer, name: malicious };
    const { container } = render(
      <LeadActionStrip
        customer={customerWithMaliciousName}
        customerId={baseCustomer.id}
        canRead={true}
        canWrite={true}
        canReadCrm={true}
        onOpenSms={noop}
        onOpenAppointment={noop}
        onOpenAddTask={noop}
        onOpenDisposition={noop}
      />
    );
    expect(container.querySelectorAll("script").length).toBe(0);
    expect(container.querySelectorAll("img").length).toBe(0);
  });

  it("detail page renders customer name as escaped text (no script/img from name)", async () => {
    const maliciousName = "<script>alert(1)</script>";
    const customerPayload = {
      ...baseCustomer,
      name: maliciousName,
    };
    const mockFetch = jest.fn();
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ data: customerPayload }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    ((globalThis as unknown as { fetch: typeof mockFetch }).fetch = mockFetch);

    const { container } = render(
      <CustomerDetailPage id="00000000-0000-0000-0000-000000000001" />
    );

    await waitFor(() => {
      expect(container.textContent).toContain(maliciousName);
    });
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelectorAll("img").length).toBe(0);
    jest.restoreAllMocks();
  });

  it("detail page renders task-title-like content as escaped text", async () => {
    const maliciousTitle = '<img onerror=alert(1)>';
    const customerPayload = { ...baseCustomer };
    const mockFetch = jest.fn();
    mockFetch
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: customerPayload }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      )
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            data: [{ id: "t1", title: maliciousTitle, dueAt: null, completedAt: null, createdAt: "", customerId: customerPayload.id }],
            meta: { total: 1, limit: 25, offset: 0 },
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      );
    ((globalThis as unknown as { fetch: typeof mockFetch }).fetch = mockFetch);

    const { container } = render(
      <CustomerDetailPage id="00000000-0000-0000-0000-000000000001" />
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
    await waitFor(() => {
      const imgCount = container.querySelectorAll("img").length;
      expect(imgCount).toBe(0);
    });
    jest.restoreAllMocks();
  });
});

describe("LeadActionStrip: SMS submit (optional mock)", () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    mockFetch.mockReset();
    ((globalThis as unknown as { fetch: typeof mockFetch }).fetch = mockFetch);
  });

  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  it("clicking Send SMS calls onOpenSms (opens SMS dialog)", () => {
    const onOpenSms = jest.fn();
    render(
      <LeadActionStrip
        customer={baseCustomer}
        customerId={baseCustomer.id}
        canRead={true}
        canWrite={true}
        canReadCrm={true}
        onOpenSms={onOpenSms}
        onOpenAppointment={noop}
        onOpenAddTask={noop}
        onOpenDisposition={noop}
      />
    );
    const toolbar = getToolbar();
    const smsButton = within(toolbar).getByRole("button", { name: /send sms/i });
    fireEvent.click(smsButton);
    expect(onOpenSms).toHaveBeenCalledTimes(1);
  });
});
