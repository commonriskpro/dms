#!/usr/bin/env node
/**
 * Ensures packages/contracts/node_modules/zod exists (symlink to root node_modules)
 * so tsc resolves "zod" on Vercel and in workspaces where deps are hoisted.
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = path.resolve(__dirname, "..", "..");
const pkgDir = __dirname;
const localNm = path.join(pkgDir, "node_modules");
const zodInRoot = path.join(root, "node_modules", "zod");
const zodInLocal = path.join(localNm, "zod");

if (!fs.existsSync(localNm)) {
  fs.mkdirSync(localNm, { recursive: true });
}
if (!fs.existsSync(zodInLocal) && fs.existsSync(zodInRoot)) {
  const type = process.platform === "win32" ? "junction" : "dir";
  fs.symlinkSync(zodInRoot, zodInLocal, type);
}

execSync("npx tsc", { stdio: "inherit", cwd: pkgDir });
