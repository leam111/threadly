/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/*.test.ts"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
  // the test database is remote (Atlas), so connecting can take more than the default 5 seconds
  testTimeout: 30000,
};