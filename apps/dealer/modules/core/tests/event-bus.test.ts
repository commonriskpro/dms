/**
 * Event Bus Infrastructure Tests
 * Tests: emitEvent, registerListener, clearListeners, getListenerCount, type safety, error isolation.
 */

import {
  emitEvent,
  registerListener,
  clearListeners,
  getListenerCount,
} from "@/lib/infrastructure/events/eventBus";

beforeEach(() => {
  clearListeners();
});

afterAll(() => {
  clearListeners();
});

describe("registerListener + emitEvent", () => {
  it("calls listener when matching event is emitted", () => {
    const handler = jest.fn();
    registerListener("vehicle.created", handler);

    emitEvent("vehicle.created", {
      dealershipId: "d-1",
      vehicleId: "v-1",
      vin: "1HGCM82633A004352",
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({
      dealershipId: "d-1",
      vehicleId: "v-1",
      vin: "1HGCM82633A004352",
    });
  });

  it("does not call listener for different event", () => {
    const handler = jest.fn();
    registerListener("vehicle.created", handler);

    emitEvent("deal.sold", { dealershipId: "d-1", dealId: "deal-1", amount: 25000 });

    expect(handler).not.toHaveBeenCalled();
  });

  it("calls multiple listeners for same event", () => {
    const handler1 = jest.fn();
    const handler2 = jest.fn();
    registerListener("deal.created", handler1);
    registerListener("deal.created", handler2);

    emitEvent("deal.created", { dealershipId: "d-1", dealId: "deal-1", customerId: "c-1" });

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  it("passes payload with dealershipId to handler", () => {
    const received: unknown[] = [];
    registerListener("customer.created", (payload) => {
      received.push(payload);
    });

    emitEvent("customer.created", { dealershipId: "d-99", customerId: "cust-42" });

    expect(received).toHaveLength(1);
    expect((received[0] as { dealershipId: string }).dealershipId).toBe("d-99");
  });
});

describe("emitEvent — missing dealershipId guard", () => {
  it("ignores events without dealershipId (logs error)", () => {
    const handler = jest.fn();
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    registerListener("vehicle.created", handler);

    // @ts-expect-error — intentionally missing dealershipId to test guard
    emitEvent("vehicle.created", { vehicleId: "v-1" });

    expect(handler).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("dealershipId")
    );
    consoleSpy.mockRestore();
  });
});

describe("registerListener — unsubscribe", () => {
  it("stops calling handler after unsubscribe", () => {
    const handler = jest.fn();
    const unsubscribe = registerListener("deal.status_changed", handler);

    emitEvent("deal.status_changed", {
      dealershipId: "d-1",
      dealId: "deal-1",
      from: "NEGOTIATION",
      to: "FINANCED",
    });
    expect(handler).toHaveBeenCalledTimes(1);

    unsubscribe();

    emitEvent("deal.status_changed", {
      dealershipId: "d-1",
      dealId: "deal-1",
      from: "FINANCED",
      to: "SOLD",
    });
    expect(handler).toHaveBeenCalledTimes(1); // still 1 — not called again
  });
});

describe("error isolation", () => {
  it("does not propagate listener errors to emitter", () => {
    const throwingHandler = jest.fn(() => {
      throw new Error("listener error");
    });
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    registerListener("vehicle.updated", throwingHandler);

    expect(() => {
      emitEvent("vehicle.updated", {
        dealershipId: "d-1",
        vehicleId: "v-1",
        fields: ["price"],
      });
    }).not.toThrow();

    consoleSpy.mockRestore();
  });

  it("continues to call other listeners even if one throws", () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const throwingHandler = jest.fn(() => { throw new Error("fail"); });
    const goodHandler = jest.fn();

    registerListener("bulk_import.requested", throwingHandler);
    registerListener("bulk_import.requested", goodHandler);

    emitEvent("bulk_import.requested", {
      dealershipId: "d-1",
      importId: "imp-1",
      rowCount: 100,
    });

    expect(goodHandler).toHaveBeenCalledTimes(1);
    consoleSpy.mockRestore();
  });
});

describe("clearListeners", () => {
  it("removes all listeners for a specific event", () => {
    const handler = jest.fn();
    registerListener("deal.sold", handler);
    expect(getListenerCount("deal.sold")).toBe(1);

    clearListeners("deal.sold");
    expect(getListenerCount("deal.sold")).toBe(0);

    emitEvent("deal.sold", { dealershipId: "d-1", dealId: "deal-1", amount: 30000 });
    expect(handler).not.toHaveBeenCalled();
  });

  it("removes all listeners when called without argument", () => {
    registerListener("vehicle.created", jest.fn());
    registerListener("deal.created", jest.fn());

    clearListeners();

    expect(getListenerCount("vehicle.created")).toBe(0);
    expect(getListenerCount("deal.created")).toBe(0);
  });
});

describe("getListenerCount", () => {
  it("returns 0 when no listeners registered", () => {
    expect(getListenerCount("analytics.requested")).toBe(0);
  });

  it("returns correct count after multiple registrations", () => {
    registerListener("vehicle.vin_decoded", jest.fn());
    registerListener("vehicle.vin_decoded", jest.fn());
    registerListener("vehicle.vin_decoded", jest.fn());

    expect(getListenerCount("vehicle.vin_decoded")).toBe(3);
  });
});
