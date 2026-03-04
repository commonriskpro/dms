#!/usr/bin/env node
/**
 * On Vercel, tsc in packages/contracts can't resolve "zod" from hoisted node_modules.
 * Use paths to point "zod" at the package. If dist is missing (some installs), point to source.
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const pkgDir = __dirname;
const root = path.resolve(pkgDir, "..", "..");
const rootZod = path.join(root, "node_modules", "zod");
const tsconfigPath = path.join(pkgDir, "tsconfig.json");
const buildConfigPath = path.join(pkgDir, "tsconfig.build.json");

// Prefer dist (types), fallback to source for type-checking when dist is missing
const zodTypesPath = fs.existsSync(path.join(rootZod, "dist", "commonjs", "index.d.ts"))
  ? "../../node_modules/zod"
  : "../../node_modules/zod/src/v3/index.ts";

const base = JSON.parse(fs.readFileSync(tsconfigPath, "utf8"));
const buildConfig = {
  ...base,
  compilerOptions: {
    ...base.compilerOptions,
    baseUrl: ".",
    paths: { zod: [zodTypesPath] },
  },
};
fs.writeFileSync(buildConfigPath, JSON.stringify(buildConfig, null, 2));

try {
  execSync(`npx tsc -p ${path.basename(buildConfigPath)}`, {
    cwd: pkgDir,
    stdio: "inherit",
  });
} finally {
  try {
    if (fs.existsSync(buildConfigPath)) fs.unlinkSync(buildConfigPath);
  } catch (_) {}
}
