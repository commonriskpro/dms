const fs = require("fs");
const path = require("path");

function* walk(dir, pred) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name !== "node_modules" && e.name !== ".next" && e.name !== ".git")
          yield* walk(p, pred);
      } else if (pred(p)) yield p;
    }
  } catch (_) {}
}

const pred = (p) =>
  /\.(test|spec)\.(ts|tsx)$/.test(p) ||
  /\.rbac\.test\.ts$/.test(p) ||
  /\.mapping\.test\.ts$/.test(p);

const files = [
  ...walk(path.join(__dirname, "..", "apps", "dealer"), pred),
  ...walk(path.join(__dirname, "..", "apps", "platform"), pred),
].filter((f) => !f.includes("vitest.setup"));

for (const f of files) {
  let s = fs.readFileSync(f, "utf8");
  let changed = false;
  if (s.includes("vitest") || s.includes("vi.")) {
    s = s.replace(/import\s*\{[^}]*\}\s*from\s*["']vitest["'];\s*\n?/g, "");
    s = s.replace(/vi\.mock\(/g, "jest.mock(");
    s = s.replace(/vi\.spyOn\(/g, "jest.spyOn(");
    s = s.replace(/vi\.clearAllMocks\(\)/g, "jest.clearAllMocks()");
    s = s.replace(/vi\.restoreAllMocks\(\)/g, "jest.restoreAllMocks()");
    s = s.replace(/vi\.importActual\(/g, "jest.requireActual(");
    s = s.replace(/vi\.importOriginal\(/g, "jest.requireActual(");
    s = s.replace(/vi\.fn\(\)/g, "jest.fn()");
    s = s.replace(/vi\.mocked\((\w+)\)/g, "($1 as jest.Mock)");
    s = s.replace(/vi\.stubGlobal\("fetch",\s*(\w+)\)/g, "((globalThis as unknown as { fetch: typeof $1 }).fetch = $1)");
    s = s.replace(/vi\.useFakeTimers\(\)/g, "jest.useFakeTimers()");
    s = s.replace(/vi\.advanceTimersByTime\(/g, "jest.advanceTimersByTime(");
    s = s.replace(/await vi\.waitFor\(/g, "await waitFor(");
    s = s.replace(/vi\.resetModules\(\)/g, "jest.resetModules()");
    s = s.replace(/\.toHaveBeenCalledOnce\(\)/g, ".toHaveBeenCalledTimes(1)");
    changed = true;
  }
  if (s.includes("describe.skipIf(!hasDb)")) {
    s = s.replace(/describe\.skipIf\(!hasDb\)/g, "(hasDb ? describe : describe.skip)");
    changed = true;
  }
  if (changed) {
    fs.writeFileSync(f, s);
    console.log("Updated:", f);
  }
}
console.log("Done.");
