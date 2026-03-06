/**
 * Unit test: when !reports.read, no report API fetch must be triggered.
 * ReportsPage guards fetchAll and useEffect with shouldFetchReports(canRead).
 */
import { shouldFetchReports } from "../../ui/ReportsPage";

describe("Reports: permission gate (no fetch when !reports.read)", () => {
  it("shouldFetchReports(false) is false so fetch is not triggered", () => {
    expect(shouldFetchReports(false)).toBe(false);
  });

  it("shouldFetchReports(true) allows fetch", () => {
    expect(shouldFetchReports(true)).toBe(true);
  });

  it("when canRead is false, a fetch callback guarded by shouldFetchReports is not invoked", () => {
    const fetchFn = jest.fn();
    const canRead = false;
    if (shouldFetchReports(canRead)) {
      fetchFn();
    }
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
