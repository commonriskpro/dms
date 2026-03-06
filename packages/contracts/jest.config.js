/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: ".",
  testMatch: ["**/*.test.ts", "**/*.spec.ts"],
  moduleNameMapper: {},
  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.d.ts"],
};
