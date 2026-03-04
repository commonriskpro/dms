/**
 * Lightweight unit tests for document UI helpers.
 * Verifies safe display behavior (no raw path; doc type labels).
 */
import { getDocTypeLabel, DOC_TYPE_LABELS } from "../ui/types";

describe("Documents UI helpers", () => {
  it("getDocTypeLabel returns label for known docType", () => {
    expect(getDocTypeLabel("BUYERS_ORDER")).toBe("Buyer's Order");
    expect(getDocTypeLabel("OTHER")).toBe("Other");
  });

  it("getDocTypeLabel returns — for null or empty", () => {
    expect(getDocTypeLabel(null)).toBe("—");
    expect(getDocTypeLabel("")).toBe("—");
  });

  it("getDocTypeLabel returns value for unknown docType (no injection)", () => {
    expect(getDocTypeLabel("UNKNOWN")).toBe("UNKNOWN");
  });

  it("DOC_TYPE_LABELS does not expose storage path or URL", () => {
    const values = Object.keys(DOC_TYPE_LABELS);
    expect(values.every((v) => !v.includes("/") && !v.includes("http"))).toBe(true);
  });
});
