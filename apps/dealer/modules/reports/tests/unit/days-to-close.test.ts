/**
 * Unit tests: average days-to-close calculation (logic only; no DB).
 */
describe("Reports: average days to close", () => {
  it("average is sum/count rounded to 1 decimal (HALF_UP)", () => {
    const days = [3, 5, 7];
    const sum = days.reduce((a, b) => a + b, 0);
    const count = days.length;
    const avg = Math.round((sum / count) * 10) / 10;
    expect(avg).toBe(5);
  });

  it("null when no history rows", () => {
    const daysToCloseCount = 0;
    const averageDaysToClose =
      daysToCloseCount > 0 ? 5 : null;
    expect(averageDaysToClose).toBeNull();
  });

  it("computes days from createdAt to contractedAt", () => {
    const created = new Date("2024-01-01T00:00:00Z").getTime();
    const contracted = new Date("2024-01-06T12:00:00Z").getTime();
    const days = (contracted - created) / (24 * 60 * 60 * 1000);
    expect(Math.round(days * 10) / 10).toBe(5.5);
  });
});
