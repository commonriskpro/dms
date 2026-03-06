#!/usr/bin/env node
/**
 * Vercel build dispatcher: when Vercel runs "npm run build" at repo root,
 * this script runs the correct app build based on VERCEL_PROJECT_NAME.
 * Use with root package.json "build": "node scripts/vercel-build.js"
 * Logs everything for debugging (no secrets).
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const log = (msg, data = {}) => {
  const payload = typeof data === "object" && Object.keys(data).length
    ? " " + JSON.stringify(data)
    : "";
  console.log("[vercel-build] " + msg + payload);
};

const projectToScript = {
  dms: "vercel-build:dealer",
  "platform-admin": "vercel-build:platform",
};

/** Expected .next output path relative to repo root (when building from root). */
const projectToOutputDir = {
  dms: "apps/dealer/.next",
  "platform-admin": "apps/platform/.next",
};

function main() {
  const cwd = process.cwd();
  const projectName = process.env.VERCEL_PROJECT_NAME || "";
  const vercelUrl = process.env.VERCEL_URL || "";
  const nodeEnv = process.env.NODE_ENV || "";
  const rootDir = process.env.VERCEL_ROOT_DIRECTORY || "";

  log("start", {
    cwd,
    VERCEL_PROJECT_NAME: projectName,
    VERCEL_ROOT_DIRECTORY: rootDir || "(empty)",
    VERCEL_URL: vercelUrl ? "(set)" : "(unset)",
    NODE_ENV: nodeEnv,
  });

  const script = projectToScript[projectName];
  const expectedOutputDir = projectToOutputDir[projectName] || projectToOutputDir.dms;

  log("output-check", {
    project: projectName,
    expectedOutputDir,
    note:
      projectName === "platform-admin" && !rootDir
        ? "When Root is empty, set Output in Vercel UI to apps/platform/.next"
        : projectName === "dms"
          ? "Root vercel.json has apps/dealer/.next; leave Output empty in UI"
          : "Set Output in UI to match expectedOutputDir when Root is empty",
  });

  if (!script) {
    log("unknown VERCEL_PROJECT_NAME, defaulting to dealer", { projectName });
    runScript("vercel-build:dealer", projectToOutputDir.dms);
    return;
  }

  log("running script", { script, expectedOutputDir });
  runScript(script, expectedOutputDir);
}

function runScript(npmScript, expectedOutputDir) {
  try {
    execSync("npm run " + npmScript, {
      stdio: "inherit",
      cwd: process.cwd(),
      shell: true,
    });
    log("done", { script: npmScript });

    if (expectedOutputDir) {
      const absPath = path.join(process.cwd(), expectedOutputDir);
      const exists = fs.existsSync(absPath);
      log("output-verify", {
        path: expectedOutputDir,
        absolutePath: absPath,
        exists,
        deployCheck: exists
          ? "OK – Vercel should serve from this output"
          : "MISSING – 404 likely; check Root/Output settings",
      });
      if (!exists) {
        log("output-verify-fail", {
          hint: "Ensure Build Command ran the correct app and Output Directory in Vercel matches this path.",
        });
      }
    }
  } catch (e) {
    log("error", {
      script: npmScript,
      message: e.message || String(e),
      status: e.status,
    });
    process.exit(e.status != null ? e.status : 1);
  }
}

main();
