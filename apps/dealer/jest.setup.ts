/**
 * Use TEST_DATABASE_URL for Prisma when running tests.
 * Set SKIP_INTEGRATION_TESTS=1 to skip DB tests.
 */
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

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
