/** @type {import('jest').Config} */
const nextJest = require("next/jest");

const createJestConfig = nextJest({
  dir: "./",
});

const customJestConfig = {
  testEnvironment: "<rootDir>/jest.env.js",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  maxWorkers: 2,
  testMatch: [
    "**/__tests__/**/*.[jt]s?(x)",
    "**/?(*.)+(spec|test).[jt]s?(x)",
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  testPathIgnorePatterns: [
    "<rootDir>/.next/",
    "<rootDir>/node_modules/",
    "app/api/platform/users/route.rbac.test.ts",
    "app/api/platform/applications/\\[id\\]/provision/route.rbac.test.ts",
    "app/api/platform/applications/\\[id\\]/invite-owner/route.rbac.test.ts",
  ],
};

module.exports = createJestConfig(customJestConfig);
