/**
 * Cinematic demo generator — pipeline runner.
 * Order: seed-demo → launch app → run-demo → generate-script → generate-voiceover
 *        → apply-effects → generate-captions → render-video.
 * Run from repo root: npm run generate-demo
 * Output: demo-output/product-trailer.mp4, product-demo.mp4, captions.srt, voiceover.mp3, script.txt
 */

import path from "path";
import { spawn, ChildProcess } from "child_process";
import fs from "fs";

const ROOT = process.cwd();
const DEMO_DIR = path.join(ROOT, "scripts", "demo-generator");
const OUT_DIR = path.join(ROOT, "demo-output");
const BASE_URL = process.env.DEMO_BASE_URL ?? "http://localhost:3000";

function runTsx(script: string, env: NodeJS.ProcessEnv = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["tsx", path.join(DEMO_DIR, script)], {
      cwd: ROOT,
      stdio: "inherit",
      shell: true,
      env: { ...process.env, ...env },
    });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`${script} exited ${code}`))
    );
  });
}

function waitForApp(timeoutMs: number): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryFetch = () => {
      fetch(BASE_URL, { method: "GET", signal: AbortSignal.timeout(5000) })
        .then((r) => (r.ok || r.status === 307 ? resolve() : tryLater()))
        .catch(tryLater);
    };
    const tryLater = () => {
      if (Date.now() - start > timeoutMs)
        reject(new Error("App did not become ready in time."));
      else setTimeout(tryFetch, 1500);
    };
    tryFetch();
  });
}

function startApp(): ChildProcess {
  const isWin = process.platform === "win32";
  return spawn(isWin ? "npm.cmd" : "npm", ["run", "dev:dealer"], {
    cwd: ROOT,
    stdio: "pipe",
    shell: true,
    env: process.env,
  });
}

function runNpm(script: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const isWin = process.platform === "win32";
    const child = spawn(isWin ? "npm.cmd" : "npm", ["run", script], {
      cwd: ROOT,
      stdio: "inherit",
      shell: true,
      env: process.env,
    });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`${script} exited ${code}`))
    );
  });
}

async function main() {
  console.log("=== Cinematic demo generator ===\n");

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log("Step 0: prisma generate (dealer)");
  await runNpm("prisma:generate:dealer");
  console.log("");

  console.log("Step 1/8: seed-demo");
  await runTsx("seed-demo.ts");
  console.log("");

  console.log("Step 2/8: launch app");
  const appProcess = startApp();
  try {
    await waitForApp(60000);
    console.log("App is ready.\n");
  } catch (e) {
    appProcess.kill();
    throw e;
  }

  console.log("Step 3/8: run-demo (record UI)");
  await runTsx("run-demo.ts");
  appProcess.kill();
  console.log("");

  console.log("Step 4/8: generate-script");
  await runTsx("generate-script.ts");
  console.log("");

  console.log("Step 5/8: generate-voiceover");
  await runTsx("generate-voiceover.ts");
  console.log("");

  console.log("Step 6/8: apply-effects");
  await runTsx("apply-effects.ts");
  console.log("");

  console.log("Step 7/8: generate-captions");
  await runTsx("generate-captions.ts");
  console.log("");

  console.log("Step 8/8: render-video");
  await runTsx("render-video.ts");
  console.log("");

  console.log("=== Done. Output: demo-output/ ===");
  console.log("  product-trailer.mp4, product-demo.mp4, captions.srt, voiceover.mp3, script.txt");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
