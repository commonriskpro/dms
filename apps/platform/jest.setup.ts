import "@testing-library/jest-dom";

if (typeof globalThis.structuredClone === "undefined") {
  (globalThis as unknown as { structuredClone: (value: unknown) => unknown }).structuredClone = (value: unknown) =>
    JSON.parse(JSON.stringify(value));
}
