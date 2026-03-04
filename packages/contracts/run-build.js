#!/usr/bin/env node
/**
 * On Vercel/CI, workspace deps are hoisted so tsc can't find "zod".
 * Install this package's deps into packages/contracts/node_modules, then run tsc.
 */
const path = require("path");
const { execSync } = require("child_process");

const pkgDir = __dirname;

// Install this package's dependencies into packages/contracts/node_modules
// so tsc resolves "zod" without relying on hoisting or NODE_PATH.
execSync("npm install --ignore-scripts", {
  cwd: pkgDir,
  stdio: "inherit",
});

execSync("npx tsc", {
  cwd: pkgDir,
  stdio: "inherit",
});
