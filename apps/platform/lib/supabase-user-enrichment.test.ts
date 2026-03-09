/**
 * Platform user enrichment: getSupabaseUserEnrichment returns empty on failure; getSupabaseUsersEnrichment returns map.
 */
import { getSupabaseUserEnrichment, getSupabaseUsersEnrichment } from "./supabase-user-enrichment";

jest.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: jest.fn(() => ({
    auth: {
      admin: {
        getUserById: jest.fn(),
      },
    },
  })),
}));

describe("supabase-user-enrichment", () => {
  beforeEach(() => jest.clearAllMocks());

  it("getSupabaseUserEnrichment returns empty when getUserById errors", async () => {
    const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
    const mockGetUserById = jest.fn().mockRejectedValue(new Error("network"));
    (createSupabaseAdminClient as jest.Mock).mockReturnValue({
      auth: { admin: { getUserById: mockGetUserById } },
    });
    const result = await getSupabaseUserEnrichment("user-uuid");
    expect(result).toEqual({ email: null, displayName: null, lastSignInAt: null });
  });

  it("getSupabaseUserEnrichment returns empty when user not found", async () => {
    const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
    (createSupabaseAdminClient as jest.Mock).mockReturnValue({
      auth: { admin: { getUserById: jest.fn().mockResolvedValue({ data: { user: null }, error: { message: "Not found" } }) } },
    });
    const result = await getSupabaseUserEnrichment("user-uuid");
    expect(result).toEqual({ email: null, displayName: null, lastSignInAt: null });
  });

  it("getSupabaseUsersEnrichment returns map for multiple ids", async () => {
    const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
    (createSupabaseAdminClient as jest.Mock).mockReturnValue({
      auth: {
        admin: {
          getUserById: jest.fn().mockImplementation((id: string) => {
            if (id === "a") return Promise.resolve({ data: { user: null }, error: { message: "x" } });
            return Promise.resolve({
              data: {
                user: {
                  email: "u@b.com",
                  user_metadata: { full_name: "User B" },
                  last_sign_in_at: "2025-01-01T12:00:00Z",
                },
              },
              error: null,
            });
          }),
        },
      },
    });
    const map = await getSupabaseUsersEnrichment(["a", "b"]);
    expect(map.get("a")).toEqual({ email: null, displayName: null, lastSignInAt: null });
    expect(map.get("b")).toEqual({
      email: "u@b.com",
      displayName: "User B",
      lastSignInAt: "2025-01-01T12:00:00.000Z",
    });
  });
});
