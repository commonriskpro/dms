/**
 * Platform accounts API RBAC: auth and PLATFORM_OWNER for POST; allowed roles for GET.
 */
jest.mock("@/lib/platform-auth", () => ({
  requirePlatformAuth: jest.fn(),
  requirePlatformRole: jest.fn(),
  PlatformApiError: class PlatformApiError extends Error {
    constructor(
      public code: string,
      message: string,
      public status: number = 403
    ) {
      super(message);
      this.name = "PlatformApiError";
    }
  },
}));
jest.mock("@/lib/service/accounts", () => ({
  createPlatformAccount: jest.fn(),
  listAccounts: jest.fn(),
}));

import { requirePlatformAuth, requirePlatformRole, PlatformApiError } from "@/lib/platform-auth";
import * as accountsService from "@/lib/service/accounts";
import { GET, POST } from "./route";

describe("Platform accounts API RBAC", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (accountsService.listAccounts as jest.Mock).mockResolvedValue({
      data: [],
      total: 0,
    });
  });

  it("GET returns 403 when requirePlatformAuth throws", async () => {
    (requirePlatformAuth as jest.Mock).mockRejectedValueOnce(
      new PlatformApiError("FORBIDDEN", "Platform access required", 403)
    );
    const req = new Request("http://localhost/api/platform/accounts");
    const res = await GET(req);
    expect(res.status).toBe(403);
    expect(accountsService.listAccounts).not.toHaveBeenCalled();
  });

  it("GET returns 200 when user has allowed role", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValue({ userId: "user-1" });
    (requirePlatformRole as jest.Mock).mockResolvedValue(undefined);
    const req = new Request("http://localhost/api/platform/accounts?limit=25&offset=0");
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(accountsService.listAccounts).toHaveBeenCalled();
  });

  it("POST returns 403 when user is not PLATFORM_OWNER", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValue({ userId: "user-1" });
    (requirePlatformRole as jest.Mock).mockRejectedValueOnce(
      new PlatformApiError("FORBIDDEN", "PLATFORM_OWNER required", 403)
    );
    const req = new Request("http://localhost/api/platform/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Acme", email: "a@acme.com" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    expect(accountsService.createPlatformAccount).not.toHaveBeenCalled();
  });

  it("POST returns 201 when user is PLATFORM_OWNER and body valid", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValue({ userId: "user-1" });
    (requirePlatformRole as jest.Mock).mockResolvedValue(undefined);
    (accountsService.createPlatformAccount as jest.Mock).mockResolvedValue({
      id: "acc-1",
      name: "Acme",
      email: "a@acme.com",
      status: "ACTIVE",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const req = new Request("http://localhost/api/platform/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Acme", email: "a@acme.com" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(accountsService.createPlatformAccount).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ name: "Acme", email: "a@acme.com" })
    );
  });
});
