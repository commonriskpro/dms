/**
 * Load .env.local from repo root so TEST_DATABASE_URL (and other vars) are set for Jest.
 * Jest does not load .env files by default.
 *
 * Environment: Tests that import @/lib/db or server-side Prisma/auth must use Node.
 * Add the docblock @jest-environment node at the top of those test files (see DEALER_TEST_INFRA_HARDENING_SPEC.md).
 */
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env.local") });
/**
 * Tests use TEST_DATABASE_URL when set (see lib/db.ts). Do not overwrite DATABASE_URL here.
 * Set SKIP_INTEGRATION_TESTS=1 to skip DB tests.
 * Integration tests require a migrated DB: run npm run db:migrate (or equivalent) against the test DB before running without SKIP_INTEGRATION_TESTS.
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
