#!/usr/bin/env node
/**
 * Ensures packages/contracts can resolve "zod" on Vercel (hoisted workspaces).
 * 1) Symlink node_modules/zod from root if possible
 * 2) Set NODE_PATH so tsc finds zod
 * 3) Run tsc; on failure print stdout/stderr so Vercel logs show real errors
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = path.resolve(__dirname, "..", "..");
const pkgDir = __dirname;
const rootNodeModules = path.join(root, "node_modules");
const localNm = path.join(pkgDir, "node_modules");
const zodInRoot = path.join(rootNodeModules, "zod");
const zodInLocal = path.join(localNm, "zod");

if (!fs.existsSync(localNm)) {
  fs.mkdirSync(localNm, { recursive: true });
}
if (!fs.existsSync(zodInLocal) && fs.existsSync(zodInRoot)) {
  try {
    const type = process.platform === "win32" ? "junction" : "dir";
    fs.symlinkSync(zodInRoot, zodInLocal, type);
  } catch (_) {
    // Symlink may fail; NODE_PATH below is fallback
  }
}

const env = { ...process.env, NODE_PATH: rootNodeModules };
try {
  execSync("npx tsc", {
    encoding: "utf8",
    cwd: pkgDir,
    env,
  });
} catch (err) {
  if (err.stdout) process.stdout.write(err.stdout);
  if (err.stderr) process.stderr.write(err.stderr);
  process.exit(err.status ?? 1);
}
