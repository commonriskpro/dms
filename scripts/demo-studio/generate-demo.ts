/**
 * Cinematic Demo Studio — pipeline orchestrator.
 * Execution order: seed-demo → run-walkthrough → ui-detector → motion-engine → spotlight-engine
 *                  → cursor-engine → scene-composer → generate-script → generate-voiceover
 *                  → generate-captions → render-video.
 * Run from repo root: npm run generate-demo
 * Output: demo-output/product-demo.mp4, product-trailer.mp4, captions.srt, voiceover.mp3,
 *         script.txt, scenes.json, camera-plan.json, chapters.json, ui-map.json, raw-demo.webm, styled-scenes/
 */

import path from "path";
import { spawn } from "child_process";
import fs from "fs";

const ROOT = process.cwd();
const DEMO_DIR = path.join(ROOT, "scripts", "demo-studio");
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

function startApp(): ReturnType<typeof spawn> {
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

async function main(): Promise<void> {
  console.log("=== Cinematic Demo Studio ===\n");

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log("Step 0: Prisma generate (dealer)");
  await runNpm("prisma:generate:dealer");
  console.log("");

  console.log("Step 1/12: seed-demo");
  await runTsx("seed-demo.ts");
  console.log("");

  console.log("Step 2/12: Launch app");
  const appProcess = startApp();
  try {
    await waitForApp(60000);
    console.log("App is ready.\n");
  } catch (e) {
    appProcess.kill();
    throw e;
  }

  console.log("Step 3/12: run-walkthrough (record UI + screenshots)");
  await runTsx("run-walkthrough.ts");
  console.log("");

  console.log("Step 4/12: ui-detector");
  await runTsx("ui-detector.ts");
  appProcess.kill();
  console.log("");

  console.log("Step 5/12: motion-engine");
  await runTsx("motion-engine.ts");
  console.log("");

  console.log("Step 6/12: spotlight-engine");
  await runTsx("spotlight-engine.ts");
  console.log("");

  console.log("Step 7/12: cursor-engine");
  await runTsx("cursor-engine.ts");
  console.log("");

  console.log("Step 8/12: scene-composer");
  await runTsx("scene-composer.ts");
  console.log("");

  console.log("Step 9/12: generate-script");
  await runTsx("generate-script.ts");
  console.log("");

  console.log("Step 10/12: generate-voiceover");
  await runTsx("generate-voiceover.ts");
  console.log("");

  console.log("Step 11/12: generate-captions");
  await runTsx("generate-captions.ts");
  console.log("");

  console.log("Step 12/12: render-video");
  await runTsx("render-video.ts");
  console.log("");

  console.log("=== Done. Output: demo-output/ ===");
  console.log("  product-demo.mp4, product-trailer.mp4, captions.srt, voiceover.mp3");
  console.log("  script.txt, scenes.json, camera-plan.json, chapters.json");
  console.log("  ui-map.json, raw-demo.webm, styled-scenes/");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
