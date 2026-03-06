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
  // Limit parallelism when running DB integration tests to avoid exhausting connection pool
  ...(process.env.TEST_DATABASE_URL && process.env.SKIP_INTEGRATION_TESTS !== "1"
    ? { maxWorkers: 2 }
    : {}),
};

module.exports = createJestConfig(customJestConfig);
