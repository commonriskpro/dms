/**
 * Cinematic Demo Studio — automated UI walkthrough.
 * Playwright: open dashboard → inventory → add vehicle → CRM pipeline → move stage → deal desk → delivery queue → dashboard.
 * Records video to raw-demo.webm and captures one screenshot per scene.
 */

import path from "path";
import fs from "fs";
import { chromium } from "playwright";
import { SCENE_REGISTRY, saveScenesJson } from "./scene-registry";
import type { SceneAction } from "./scene-registry";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "demo-output");
const RAW_VIDEO = path.join(OUT_DIR, "raw-demo.webm");

const BASE_URL = process.env.DEMO_BASE_URL ?? "http://localhost:3000";
const DEMO_USER_EMAIL = process.env.DEMO_USER_EMAIL ?? "";
const DEMO_USER_PASSWORD = process.env.DEMO_USER_PASSWORD ?? "";

const SCENE_HOLD_MS = (s: number) => s * 1000;
const TRANSITION_MS = 800;
const THEME_STORAGE_KEY = "dealer-ui-theme";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function applyDarkTheme(
  page: Awaited<ReturnType<Awaited<ReturnType<typeof chromium.launch>>["newPage"]>>
): Promise<void> {
  await page.evaluate((key: string) => {
    localStorage.setItem(key, "dark");
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add("dark");
    root.setAttribute("data-theme", "dark");
    root.style.colorScheme = "dark";
  }, THEME_STORAGE_KEY);
  await page.reload({ waitUntil: "domcontentloaded" });
  await sleep(500);
}

async function executeAction(
  page: Awaited<ReturnType<Awaited<ReturnType<typeof chromium.launch>>["newPage"]>>,
  action: SceneAction
): Promise<void> {
  switch (action) {
    case "open_dashboard":
      await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "domcontentloaded" });
      break;
    case "open_inventory":
      await page.goto(`${BASE_URL}/inventory`, { waitUntil: "domcontentloaded" });
      break;
    case "open_add_vehicle":
      await page.getByRole("link", { name: /add vehicle/i }).first().click({ timeout: 8000 }).catch(() => {});
      await page.locator('input[name="vin"], input[placeholder*="VIN"]').first().waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
      await sleep(TRANSITION_MS);
      await page.keyboard.press("Escape");
      break;
    case "open_crm_pipeline":
      await page.goto(`${BASE_URL}/crm/opportunities?view=board`, { waitUntil: "domcontentloaded" });
      break;
    case "move_opportunity_stage": {
      const card = page.locator('[data-testid="opportunity-card"], [data-opportunity-id], .opportunity-card').first();
      if (await card.isVisible().catch(() => false)) await card.click();
      break;
    }
    case "open_deals":
      await page.goto(`${BASE_URL}/deals`, { waitUntil: "domcontentloaded" });
      break;
    case "open_deal_modal": {
      const link = page.getByRole("link", { name: /start deal|new deal/i }).first();
      if (await link.isVisible().catch(() => false)) {
        await link.click();
        await sleep(TRANSITION_MS);
        await page.keyboard.press("Escape");
      }
      break;
    }
    case "open_delivery_queue":
      await page.goto(`${BASE_URL}/deals/delivery`, { waitUntil: "domcontentloaded" });
      break;
    case "closing_overview":
      await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "domcontentloaded" });
      break;
    default:
      break;
  }
}

export async function runWalkthrough(): Promise<void> {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  saveScenesJson();

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: OUT_DIR, size: { width: 1920, height: 1080 } },
    ignoreHTTPSErrors: true,
  });

  const page = await context.newPage();

  try {
    if (DEMO_USER_EMAIL && DEMO_USER_PASSWORD) {
      await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
      await applyDarkTheme(page);
      await page.locator('input[name="email"]').fill(DEMO_USER_EMAIL);
      await page.locator('input[name="password"]').fill(DEMO_USER_PASSWORD);
      await page.getByRole("button", { name: /sign in/i }).click();
      await page.waitForURL((url) => url.pathname !== "/login", { timeout: 15000 });
      await sleep(SCENE_HOLD_MS(2));
      if (page.url().includes("/get-started")) {
        await page.getByRole("button", { name: /Dealer A|Demo Dealership/i }).first().click({ timeout: 8000 });
        await page.waitForURL((url) => !url.pathname.includes("/get-started"), { timeout: 10000 }).catch(() => {});
        await sleep(SCENE_HOLD_MS(2));
      }
    } else {
      await page.goto(BASE_URL, { waitUntil: "networkidle" });
      await applyDarkTheme(page);
      await sleep(SCENE_HOLD_MS(2));
    }

    for (const scene of SCENE_REGISTRY) {
      console.log(`[run-walkthrough] Scene: ${scene.id} (${scene.action}, ${scene.duration}s)`);
      await executeAction(page, scene.action);
      await sleep(SCENE_HOLD_MS(scene.duration));
      try {
        await page.screenshot({ path: path.join(OUT_DIR, `scene-${scene.id}.png`) });
      } catch {
        // ignore screenshot errors
      }
    }
  } finally {
    const video = page.video();
    await context.close();
    await sleep(500);
    if (video) {
      try {
        const videoPath = await video.path();
        if (videoPath && fs.existsSync(videoPath)) {
          fs.renameSync(videoPath, RAW_VIDEO);
          console.log("[run-walkthrough] Video saved to", RAW_VIDEO);
        }
      } catch {
        // ignore
      }
    }
    if (!fs.existsSync(RAW_VIDEO) && fs.existsSync(OUT_DIR)) {
      const files = fs.readdirSync(OUT_DIR);
      const webm = files.find((f) => f.endsWith(".webm"));
      if (webm) {
        fs.renameSync(path.join(OUT_DIR, webm), RAW_VIDEO);
        console.log("[run-walkthrough] Video saved to", RAW_VIDEO);
      }
    }
  }

  await browser.close();
}

function main(): void {
  runWalkthrough().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
main();
