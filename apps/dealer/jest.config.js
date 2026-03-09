/** @type {import('jest').Config} */
const nextJest = require("next/jest");

const createJestConfig = nextJest({
  dir: "./",
});

const customJestConfig = {
  testEnvironment: "<rootDir>/jest.env.js",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testMatch: [
    "**/__tests__/**/*.[jt]s?(x)",
    "**/?(*.)+(spec|test).[jt]s?(x)",
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  testPathIgnorePatterns: ["<rootDir>/.next/", "<rootDir>/node_modules/"],
  // Single worker when integration tests run to avoid DB connection exhaustion and OOM
  ...(process.env.TEST_DATABASE_URL && process.env.SKIP_INTEGRATION_TESTS !== "1"
    ? { maxWorkers: 1 }
    : {}),
};

module.exports = createJestConfig(customJestConfig);
