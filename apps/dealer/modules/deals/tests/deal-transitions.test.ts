/**
 * Deal state machine: CONTRACTED and CANCELED cannot change (except CONTRACTED -> CANCELED).
 * Invalid transitions throw DOMAIN_ERROR in updateDealStatus; this file tests the transition matrix.
 */
import { ALLOWED_TRANSITIONS, isAllowedTransition } from "../service/deal-transitions";
import type { DealStatus } from "@prisma/client";

const STATUSES: DealStatus[] = ["DRAFT", "STRUCTURED", "APPROVED", "CONTRACTED", "CANCELED"];

describe("Deal status transitions", () => {
  it("CONTRACTED can only transition to CANCELED", () => {
    expect(ALLOWED_TRANSITIONS.CONTRACTED).toEqual(["CANCELED"]);
    expect(isAllowedTransition("CONTRACTED", "CANCELED")).toBe(true);
    expect(isAllowedTransition("CONTRACTED", "APPROVED")).toBe(false);
    expect(isAllowedTransition("CONTRACTED", "DRAFT")).toBe(false);
    expect(isAllowedTransition("CONTRACTED", "STRUCTURED")).toBe(false);
    expect(isAllowedTransition("CONTRACTED", "CONTRACTED")).toBe(false);
  });

  it("CANCELED cannot transition to any status", () => {
    expect(ALLOWED_TRANSITIONS.CANCELED).toEqual([]);
    for (const to of STATUSES) {
      expect(isAllowedTransition("CANCELED", to)).toBe(false);
    }
  });

  it("invalid transitions are not allowed", () => {
    expect(isAllowedTransition("DRAFT", "APPROVED")).toBe(false);
    expect(isAllowedTransition("DRAFT", "CONTRACTED")).toBe(false);
    expect(isAllowedTransition("STRUCTURED", "DRAFT")).toBe(false);
    expect(isAllowedTransition("APPROVED", "STRUCTURED")).toBe(false);
    expect(isAllowedTransition("CONTRACTED", "CONTRACTED")).toBe(false);
  });

  it("valid transitions are allowed", () => {
    expect(isAllowedTransition("DRAFT", "STRUCTURED")).toBe(true);
    expect(isAllowedTransition("DRAFT", "CANCELED")).toBe(true);
    expect(isAllowedTransition("STRUCTURED", "APPROVED")).toBe(true);
    expect(isAllowedTransition("STRUCTURED", "CANCELED")).toBe(true);
    expect(isAllowedTransition("APPROVED", "CONTRACTED")).toBe(true);
    expect(isAllowedTransition("APPROVED", "CANCELED")).toBe(true);
    expect(isAllowedTransition("CONTRACTED", "CANCELED")).toBe(true);
  });
});
