/**
 * Domain Event Bus — Node EventEmitter-based, synchronous dispatch.
 * All payloads MUST include dealershipId for tenant isolation.
 *
 * NO imports from modules/* — infrastructure layer is module-independent.
 * NO dependency on rate-limit or metrics — single responsibility.
 */

import { EventEmitter } from "events";

// ---------------------------------------------------------------------------
// Event payload types
// ---------------------------------------------------------------------------

export type DomainEventPayload = {
  dealershipId: string;
  [key: string]: unknown;
};

export type VehicleCreatedPayload = DomainEventPayload & {
  vehicleId: string;
  vin?: string;
};

export type VehicleUpdatedPayload = DomainEventPayload & {
  vehicleId: string;
  fields: string[];
};

export type VehicleVinDecodedPayload = DomainEventPayload & {
  vehicleId: string;
  vin: string;
  source: "api" | "cache";
};

export type DealCreatedPayload = DomainEventPayload & {
  dealId: string;
  customerId: string;
};

export type DealStatusChangedPayload = DomainEventPayload & {
  dealId: string;
  from: string;
  to: string;
};

export type DealSoldPayload = DomainEventPayload & {
  dealId: string;
  amount: number;
};

export type CustomerCreatedPayload = DomainEventPayload & {
  customerId: string;
};

export type BulkImportRequestedPayload = DomainEventPayload & {
  importId: string;
  rowCount: number;
};

export type AnalyticsRequestedPayload = DomainEventPayload & {
  type: string;
  context?: Record<string, unknown>;
};

export type OpportunityCreatedPayload = DomainEventPayload & {
  opportunityId: string;
  customerId: string;
  stageId: string;
};

export type OpportunityStageChangedPayload = DomainEventPayload & {
  opportunityId: string;
  fromStageId: string;
  toStageId: string;
};

export type OpportunityStatusChangedPayload = DomainEventPayload & {
  opportunityId: string;
  fromStatus: string;
  toStatus: string;
};

export type CustomerTaskCompletedPayload = DomainEventPayload & {
  customerId: string;
  taskId: string;
  completedBy?: string;
};

// ---------------------------------------------------------------------------
// Event map — all domain events and their payload types
// ---------------------------------------------------------------------------

export type DomainEventMap = {
  "vehicle.created": VehicleCreatedPayload;
  "vehicle.updated": VehicleUpdatedPayload;
  "vehicle.vin_decoded": VehicleVinDecodedPayload;
  "deal.created": DealCreatedPayload;
  "deal.status_changed": DealStatusChangedPayload;
  "deal.sold": DealSoldPayload;
  "customer.created": CustomerCreatedPayload;
  "customer.task_completed": CustomerTaskCompletedPayload;
  "bulk_import.requested": BulkImportRequestedPayload;
  "analytics.requested": AnalyticsRequestedPayload;
  "opportunity.created": OpportunityCreatedPayload;
  "opportunity.stage_changed": OpportunityStageChangedPayload;
  "opportunity.status_changed": OpportunityStatusChangedPayload;
};

export type DomainEventName = keyof DomainEventMap;
export type DomainEventHandler<E extends DomainEventName> = (
  payload: DomainEventMap[E]
) => void | Promise<void>;

// ---------------------------------------------------------------------------
// Singleton emitter
// ---------------------------------------------------------------------------

class DomainEventBus {
  private emitter: EventEmitter;

  constructor() {
    this.emitter = new EventEmitter();
    // Increase listener limit for production use
    this.emitter.setMaxListeners(50);
  }

  /**
   * Emit a domain event. Payload must include dealershipId.
   * Listeners are called synchronously (EventEmitter default).
   * Errors in listeners are caught and logged to avoid crashing the caller.
   */
  emit<E extends DomainEventName>(event: E, payload: DomainEventMap[E]): void {
    if (!payload.dealershipId) {
      console.error(`[EventBus] Event "${event}" emitted without dealershipId — ignored`);
      return;
    }
    try {
      this.emitter.emit(event, payload);
    } catch (err) {
      console.error(`[EventBus] Error emitting event "${event}":`, err);
    }
  }

  /**
   * Register a listener for a domain event.
   * Returns an unsubscribe function.
   */
  on<E extends DomainEventName>(
    event: E,
    handler: DomainEventHandler<E>
  ): () => void {
    const wrappedHandler = async (payload: DomainEventMap[E]) => {
      try {
        await handler(payload);
      } catch (err) {
        console.error(`[EventBus] Error in listener for "${event}":`, err);
      }
    };
    this.emitter.on(event, wrappedHandler as (...args: unknown[]) => void);
    return () => {
      this.emitter.off(event, wrappedHandler as (...args: unknown[]) => void);
    };
  }

  /**
   * Register a one-time listener.
   */
  once<E extends DomainEventName>(
    event: E,
    handler: DomainEventHandler<E>
  ): void {
    this.emitter.once(event, handler as (...args: unknown[]) => void);
  }

  /**
   * Remove all listeners for a specific event (useful in tests).
   */
  removeAllListeners(event?: DomainEventName): void {
    if (event) {
      this.emitter.removeAllListeners(event);
    } else {
      this.emitter.removeAllListeners();
    }
  }

  /** Returns registered listener count for a given event (useful in tests). */
  listenerCount(event: DomainEventName): number {
    return this.emitter.listenerCount(event);
  }
}

// ---------------------------------------------------------------------------
// Public API — functional wrappers around the singleton
// ---------------------------------------------------------------------------

const bus = new DomainEventBus();

/**
 * Emit a domain event. All payloads must include dealershipId.
 */
export function emitEvent<E extends DomainEventName>(
  event: E,
  payload: DomainEventMap[E]
): void {
  bus.emit(event, payload);
}

/**
 * Register a listener for a domain event.
 * Returns an unsubscribe function.
 */
export function registerListener<E extends DomainEventName>(
  event: E,
  handler: DomainEventHandler<E>
): () => void {
  return bus.on(event, handler);
}

/**
 * Remove all listeners (e.g., between tests).
 */
export function clearListeners(event?: DomainEventName): void {
  bus.removeAllListeners(event);
}

/**
 * Returns listener count for a given event (useful in tests/health checks).
 */
export function getListenerCount(event: DomainEventName): number {
  return bus.listenerCount(event);
}

export { bus as _eventBusInstance };
