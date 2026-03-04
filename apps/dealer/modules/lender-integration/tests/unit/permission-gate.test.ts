/**
 * Unit tests: when permission is missing, no fetch must be triggered.
 * DealLendersTab and LendersDirectoryPage guard fetches with permission checks;
 * these tests assert the guards prevent fetch (reports-page-permission style).
 */
import {
  shouldFetchSubmissions,
  shouldFetchDealDocuments,
  shouldFetchLenders,
} from "../../ui/DealLendersTab";
import { shouldFetchLenders as shouldFetchLendersDirectory } from "../../ui/LendersDirectoryPage";

describe("DealLendersTab: permission gate (no fetch when !finance.submissions.read)", () => {
  it("shouldFetchSubmissions(false) is false so fetch is not triggered", () => {
    expect(shouldFetchSubmissions(false)).toBe(false);
  });

  it("shouldFetchSubmissions(true) allows fetch", () => {
    expect(shouldFetchSubmissions(true)).toBe(true);
  });

  it("when canRead is false, a fetch callback guarded by shouldFetchSubmissions is not invoked", () => {
    const fetchFn = jest.fn();
    if (shouldFetchSubmissions(false)) {
      fetchFn();
    }
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe("DealLendersTab: permission gate (no fetch when !lenders.read)", () => {
  it("shouldFetchLenders(false) is false so fetch is not triggered", () => {
    expect(shouldFetchLenders(false)).toBe(false);
  });

  it("when canRead is false, a fetch callback guarded by shouldFetchLenders is not invoked", () => {
    const fetchFn = jest.fn();
    if (shouldFetchLenders(false)) {
      fetchFn();
    }
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe("DealLendersTab: permission gate (no /api/documents when !documents.read)", () => {
  it("shouldFetchDealDocuments(false) is false so documents fetch is not triggered", () => {
    expect(shouldFetchDealDocuments(false)).toBe(false);
  });

  it("when canRead is false, a fetch callback guarded by shouldFetchDealDocuments is not invoked", () => {
    const fetchFn = jest.fn();
    if (shouldFetchDealDocuments(false)) {
      fetchFn();
    }
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe("LendersDirectoryPage: permission gate (no fetch when !lenders.read)", () => {
  it("shouldFetchLenders(false) is false so fetch is not triggered", () => {
    expect(shouldFetchLendersDirectory(false)).toBe(false);
  });

  it("when canRead is false, a fetch callback guarded by shouldFetchLenders is not invoked", () => {
    const fetchFn = jest.fn();
    if (shouldFetchLendersDirectory(false)) {
      fetchFn();
    }
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
