/**
 * Use TEST_DATABASE_URL for Prisma when running tests, so production DATABASE_URL
 * is never used for integration tests. Set SKIP_INTEGRATION_TESTS=1 to skip DB tests.
 */
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

import { vi } from "vitest";
import { expect } from "vitest";
import * as matchers from "@testing-library/jest-dom/matchers";
expect.extend(matchers);

// Mock next/cache and React cache so platform-admin and route handlers work in tests
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    cache: <T>(fn: T): T => fn,
  };
});
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));
