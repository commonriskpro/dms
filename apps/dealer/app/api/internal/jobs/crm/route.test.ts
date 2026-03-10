/** @jest-environment node */
const mockAuthorizeInternalJobRequest = jest.fn();
const mockInternalJobError = jest.fn((code: string, message: string, status: number, details?: unknown) =>
  Response.json(details != null ? { error: { code, message, details } } : { error: { code, message } }, { status })
);

jest.mock("../route-helpers", () => ({
  authorizeInternalJobRequest: (...args: unknown[]) => mockAuthorizeInternalJobRequest(...args),
  internalJobError: (...args: unknown[]) => mockInternalJobError(...args),
}));

const mockSafeParse = jest.fn();
jest.mock("../schemas", () => ({
  internalCrmExecutionJobSchema: {
    safeParse: (...args: unknown[]) => mockSafeParse(...args),
  },
}));

const mockRunJobWorker = jest.fn();
jest.mock("@/modules/crm-pipeline-automation/service/job-worker", () => ({
  runJobWorker: (...args: unknown[]) => mockRunJobWorker(...args),
}));

import { POST } from "./route";

describe("POST /api/internal/jobs/crm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthorizeInternalJobRequest.mockResolvedValue(null);
    mockSafeParse.mockReturnValue({
      success: true,
      data: { dealershipId: "11111111-1111-1111-1111-111111111111", source: "manual" },
    });
    mockRunJobWorker.mockResolvedValue({ processed: 2, failed: 0, deadLetter: 0 });
  });

  it("returns auth failure when internal auth does not pass", async () => {
    const authFailure = Response.json({ error: { code: "UNAUTHORIZED", message: "Nope" } }, { status: 401 });
    mockAuthorizeInternalJobRequest.mockResolvedValueOnce(authFailure);

    const req = new Request("http://localhost/api/internal/jobs/crm", { method: "POST" });
    const res = await POST(req as unknown as import("next/server").NextRequest);

    expect(res.status).toBe(401);
    expect(mockRunJobWorker).not.toHaveBeenCalled();
  });

  it("returns 422 when validation fails", async () => {
    mockSafeParse.mockReturnValueOnce({
      success: false,
      error: { flatten: () => ({ fieldErrors: { dealershipId: ["Required"] } }) },
    });

    const req = new Request("http://localhost/api/internal/jobs/crm", {
      method: "POST",
      body: JSON.stringify({ dealershipId: "bad" }),
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);

    expect(res.status).toBe(422);
    expect(mockRunJobWorker).not.toHaveBeenCalled();
  });

  it("runs the CRM job worker and returns its summary", async () => {
    const req = new Request("http://localhost/api/internal/jobs/crm", {
      method: "POST",
      body: JSON.stringify({ dealershipId: "11111111-1111-1111-1111-111111111111", source: "manual" }),
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);

    expect(res.status).toBe(200);
    expect(mockRunJobWorker).toHaveBeenCalledWith("11111111-1111-1111-1111-111111111111");
    await expect(res.json()).resolves.toEqual({
      data: { processed: 2, failed: 0, deadLetter: 0 },
    });
  });
});
