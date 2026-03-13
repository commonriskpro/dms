/**
 * Cinematic Demo Studio — UI detection engine.
 * Playwright DOM inspection: capture selector, x, y, width, height per scene.
 * Saves /demo-output/ui-map.json. App must be running at DEMO_BASE_URL.
 */

import path from "path";
import fs from "fs";
import { chromium } from "playwright";
import { SCENE_REGISTRY } from "./scene-registry";
import type { RegisteredScene } from "./scene-registry";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "demo-output");
const UI_MAP_PATH = path.join(OUT_DIR, "ui-map.json");

const BASE_URL = process.env.DEMO_BASE_URL ?? "http://localhost:3000";
const DEMO_USER_EMAIL = process.env.DEMO_USER_EMAIL ?? "";
const DEMO_USER_PASSWORD = process.env.DEMO_USER_PASSWORD ?? "";

export type UIElementMeta = {
  sceneId: string;
  selector: string;
  x: number;
  y: number;
  width: number;
  height: number;
  boundingBox: { x: number; y: number; width: number; height: number };
};

export type UIMap = {
  viewport: { width: number; height: number };
  capturedAt: string;
  elements: UIElementMeta[];
};

const TRANSITION_MS = 800;
const SCENE_HOLD_MS = (s: number) => s * 1000;
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
  action: RegisteredScene["action"]
): Promise<void> {
  switch (action) {
    case "open_dashboard":
      await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "domcontentloaded" });
      break;
    case "open_inventory":
      await page.goto(`${BASE_URL}/inventory`, { waitUntil: "domcontentloaded" });
      break;
    case "open_add_vehicle":
      await page.goto(`${BASE_URL}/inventory`, { waitUntil: "domcontentloaded" });
      await sleep(TRANSITION_MS);
      await page.getByRole("link", { name: /add vehicle/i }).first().click({ timeout: 8000 }).catch(() => {});
      await sleep(TRANSITION_MS);
      break;
    case "open_crm_pipeline":
      await page.goto(`${BASE_URL}/crm/opportunities?view=board`, { waitUntil: "domcontentloaded" });
      break;
    case "move_opportunity_stage":
      await page.goto(`${BASE_URL}/crm/opportunities?view=board`, { waitUntil: "domcontentloaded" });
      await sleep(TRANSITION_MS);
      break;
    case "open_deals":
      await page.goto(`${BASE_URL}/deals`, { waitUntil: "domcontentloaded" });
      break;
    case "open_deal_modal":
      await page.goto(`${BASE_URL}/deals`, { waitUntil: "domcontentloaded" });
      await page.getByRole("link", { name: /start deal|new deal/i }).first().click({ timeout: 6000 }).catch(() => {});
      await sleep(TRANSITION_MS);
      break;
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

async function getBoundingBox(
  page: Awaited<ReturnType<Awaited<ReturnType<typeof chromium.launch>>["newPage"]>>,
  selector: string
): Promise<{ x: number; y: number; width: number; height: number } | null> {
  if (!selector.trim()) return null;
  const parts = selector.split(",").map((s) => s.trim());
  for (const sel of parts) {
    try {
      if ((await page.locator(sel).count()) === 0) continue;
      const el = page.locator(sel).first();
      const box = await el.boundingBox();
      if (box && box.width > 0 && box.height > 0) return box;
    } catch {
      // try next selector
    }
  }
  return null;
}

export async function runUIDetector(): Promise<void> {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  const elements: UIElementMeta[] = [];

  try {
    if (DEMO_USER_EMAIL && DEMO_USER_PASSWORD) {
      await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
      await applyDarkTheme(page);
      await page.locator('input[name="email"]').fill(DEMO_USER_EMAIL);
      await page.locator('input[name="password"]').fill(DEMO_USER_PASSWORD);
      await page.getByRole("button", { name: /sign in/i }).click();
      await page.waitForURL((url) => url.pathname !== "/login", { timeout: 15000 });
      await sleep(2000);
      if (page.url().includes("/get-started")) {
        await page.getByRole("button", { name: /Dealer A|Demo Dealership/i }).first().click({ timeout: 8000 });
        await page.waitForURL((url) => !url.pathname.includes("/get-started"), { timeout: 10000 }).catch(() => {});
        await sleep(2000);
      }
    } else {
      await page.goto(BASE_URL, { waitUntil: "networkidle" });
      await applyDarkTheme(page);
      await sleep(2000);
    }

    for (const scene of SCENE_REGISTRY) {
      console.log(`[ui-detector] Scene: ${scene.id}`);
      await executeAction(page, scene.action);
      await sleep(TRANSITION_MS);

      const box = scene.selector ? await getBoundingBox(page, scene.selector) : null;
      if (box) {
        elements.push({
          sceneId: scene.id,
          selector: scene.selector,
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
          boundingBox: { x: box.x, y: box.y, width: box.width, height: box.height },
        });
      } else {
        elements.push({
          sceneId: scene.id,
          selector: scene.selector || "body",
          x: 0,
          y: 0,
          width: 1920,
          height: 1080,
          boundingBox: { x: 0, y: 0, width: 1920, height: 1080 },
        });
      }
      await sleep(500);
    }
  } finally {
    await context.close();
    await browser.close();
  }

  const uiMap: UIMap = {
    viewport: { width: 1920, height: 1080 },
    capturedAt: new Date().toISOString(),
    elements,
  };
  fs.writeFileSync(UI_MAP_PATH, JSON.stringify(uiMap, null, 2), "utf-8");
  console.log("[ui-detector] Wrote", UI_MAP_PATH);
}

function main(): void {
  runUIDetector().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
main();
