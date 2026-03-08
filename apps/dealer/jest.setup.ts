/**
 * Load .env.local from repo root so TEST_DATABASE_URL (and other vars) are set for Jest.
 * Jest does not load .env files by default.
 *
 * Environment: Tests that import @/lib/db or server-side Prisma/auth must use Node.
 * Add the docblock @jest-environment node at the top of those test files (see DEALER_TEST_INFRA_HARDENING_SPEC.md).
 */
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env.local") });
// When running integration tests, ensure DATABASE_URL is set so Prisma and lib/db resolve the same DB (lib/db uses TEST_DATABASE_URL ?? DATABASE_URL and passes datasourceUrl).
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}
/**
 * Set SKIP_INTEGRATION_TESTS=1 to skip DB tests.
 * Integration tests require a migrated DB: set DATABASE_URL (or DIRECT_DATABASE_URL) in .env.local to the test DB URL, then run npm run db:migrate from repo root.
 */
import "@testing-library/jest-dom";

jest.mock("react", () => {
  const actual = jest.requireActual<typeof import("react")>("react");
  return Object.assign({}, actual, {
    cache: (fn: unknown) => fn,
  });
});

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
  revalidateTag: jest.fn(),
}));

// Release DB connections after each test file so we don't hold the pool for the entire run (reduces exhaustion on Supabase).
afterAll(async () => {
  try {
    const { prisma } = await import("@/lib/db");
    await prisma.$disconnect();
  } catch {
    // ignore
  }
});
