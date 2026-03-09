/** @jest-environment node */
/**
 * Audit sanitization: metadata keys email, phone, token (and other PII_KEYS) are redacted
 * to "[REDACTED]" before writing. Tested via auditLog with mocked prisma.
 */
const mockCreate = jest.fn();

jest.mock("@/lib/db", () => ({
  prisma: {
    auditLog: {
      create: (args: { data: { metadata?: object } }) => mockCreate(args),
    },
  },
}));

describe("audit sanitization", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it("auditLog redacts email, phone, token in metadata to [REDACTED]", async () => {
    const { auditLog } = await import("@/lib/audit");
    await auditLog({
      dealershipId: "d1",
      actorUserId: "u1",
      action: "test.action",
      entity: "Test",
      metadata: {
        email: "u@example.com",
        phone: "+15551234567",
        token: "secret-token-123",
        inviteId: "inv-1",
      },
    });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const call = mockCreate.mock.calls[0][0];
    const metadata = call?.data?.metadata as Record<string, unknown> | undefined;
    expect(metadata).toBeDefined();
    expect(metadata?.email).toBe("[REDACTED]");
    expect(metadata?.phone).toBe("[REDACTED]");
    expect(metadata?.token).toBe("[REDACTED]");
    expect(metadata?.inviteId).toBe("inv-1");
  });

  it("auditLog redacts case-insensitive PII keys (Email, PHONE)", async () => {
    const { auditLog } = await import("@/lib/audit");
    await auditLog({
      dealershipId: null,
      actorUserId: null,
      action: "test.action",
      entity: "Test",
      metadata: {
        Email: "a@b.com",
        PHONE: "555-0000",
      },
    });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const metadata = mockCreate.mock.calls[0][0]?.data?.metadata as Record<string, unknown>;
    expect(metadata?.Email).toBe("[REDACTED]");
    expect(metadata?.PHONE).toBe("[REDACTED]");
  });
});
