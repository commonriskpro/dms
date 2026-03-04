/**
 * floorplan-cache: TTL, key by dealershipId, provider not called twice within TTL.
 */
import { getCachedFloorplan, clearFloorplanCacheForTesting } from "../service/floorplan-cache";

describe("floorplan-cache", () => {
  const dealershipId = "550e8400-e29b-41d4-a716-446655440000";

  beforeEach(() => {
    clearFloorplanCacheForTesting();
  });

  it("returns provider result and caches by dealershipId", async () => {
    const line = { name: "Lender A", utilizedCents: 1000, limitCents: 5000, statusLabel: "OK" };
    const provider = jest.fn().mockResolvedValue([line]);

    const result = await getCachedFloorplan(dealershipId, provider);

    expect(provider).toHaveBeenCalledTimes(1);
    expect(provider).toHaveBeenCalledWith(dealershipId);
    expect(result).toEqual([line]);
  });

  it("does not call provider twice within TTL for same dealershipId", async () => {
    const line = { name: "Lender A", utilizedCents: 0, limitCents: 0 };
    const provider = jest.fn().mockResolvedValue([line]);

    const result1 = await getCachedFloorplan(dealershipId, provider);
    const result2 = await getCachedFloorplan(dealershipId, provider);

    expect(provider).toHaveBeenCalledTimes(1);
    expect(result1).toEqual([line]);
    expect(result2).toEqual([line]);
  });

  it("calls provider for different dealershipId", async () => {
    const provider = jest.fn().mockResolvedValue([]);
    const otherId = "660e8400-e29b-41d4-a716-446655440001";

    await getCachedFloorplan(dealershipId, provider);
    await getCachedFloorplan(otherId, provider);

    expect(provider).toHaveBeenCalledTimes(2);
    expect(provider).toHaveBeenCalledWith(dealershipId);
    expect(provider).toHaveBeenCalledWith(otherId);
  });
});
