/**
 * Demo pipeline — automated UI walkthrough with Playwright.
 * Records video to demo-output/raw-demo.webm.
 * Run from repo root. Set DEMO_USER_EMAIL and DEMO_USER_PASSWORD to log in; otherwise assumes already logged in or skips.
 */

import path from "path";
import fs from "fs";
import { chromium } from "playwright";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "demo-output");
const RAW_VIDEO = path.join(OUT_DIR, "raw-demo.webm");

const BASE_URL = process.env.DEMO_BASE_URL ?? "http://localhost:3000";
const DEMO_USER_EMAIL = process.env.DEMO_USER_EMAIL ?? "";
const DEMO_USER_PASSWORD = process.env.DEMO_USER_PASSWORD ?? "";

const WAIT_MS = 1500;
const NAV_WAIT_MS = 2500;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function runWalkthrough(): Promise<void> {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: OUT_DIR,
      size: { width: 1920, height: 1080 },
    },
    ignoreHTTPSErrors: true,
  });

  const page = await context.newPage();

  try {
    // Optional login
    if (DEMO_USER_EMAIL && DEMO_USER_PASSWORD) {
      console.log("[walkthrough] Logging in...");
      await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
      await sleep(WAIT_MS);
      await page.locator('input[name="email"]').fill(DEMO_USER_EMAIL);
      await page.locator('input[name="password"]').fill(DEMO_USER_PASSWORD);
      await page.getByRole('button', { name: /sign in/i }).click();
      await page.waitForURL((url) => url.pathname !== "/login", { timeout: 15000 });
      await sleep(NAV_WAIT_MS);

      // If redirected to get-started (no active dealership), click the dealership button (e.g. "Dealer A" or "Demo Dealership")
      if (page.url().includes("/get-started")) {
        console.log("[walkthrough] Selecting dealership on Get started...");
        await page.getByRole("button", { name: /Dealer A|Demo Dealership/i }).first().click({ timeout: 8000 });
        await page.waitForURL((url) => !url.pathname.includes("/get-started"), { timeout: 10000 }).catch(() => {});
        await sleep(NAV_WAIT_MS);
      }
    } else {
      console.log("[walkthrough] No DEMO_USER_EMAIL/DEMO_USER_PASSWORD; going to base URL (assume already logged in or public).");
      await page.goto(BASE_URL, { waitUntil: "networkidle" });
      await sleep(NAV_WAIT_MS);
    }

    // 1. Open dashboard
    console.log("[walkthrough] 1. Dashboard");
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "domcontentloaded" });
    await sleep(NAV_WAIT_MS);

    // 2. Open inventory
    console.log("[walkthrough] 2. Inventory");
    await page.goto(`${BASE_URL}/inventory`, { waitUntil: "domcontentloaded" });
    await sleep(NAV_WAIT_MS);

    // 3. Add vehicle — open via link so it opens in modal (intercepting route)
    console.log("[walkthrough] 3. Add vehicle (modal)");
    await page.getByRole("link", { name: /add vehicle/i }).first().click({ timeout: 8000 });
    await page.locator('input[name="vin"], input[placeholder*="VIN"]').first().waitFor({ state: "visible", timeout: 8000 }).catch(() => {});
    await sleep(NAV_WAIT_MS);
    await page.keyboard.press("Escape");
    await sleep(WAIT_MS);

    // 5. Open CRM pipeline
    console.log("[walkthrough] 5. CRM pipeline");
    await page.goto(`${BASE_URL}/crm/opportunities?view=board`, { waitUntil: "domcontentloaded" });
    await sleep(NAV_WAIT_MS);

    // 6. Move opportunity stage (click first card if present and drag or click next stage)
    const firstCard = page.locator('[data-testid="opportunity-card"], [data-opportunity-id], .opportunity-card').first();
    if (await firstCard.isVisible().catch(() => false)) {
      await firstCard.click();
      await sleep(WAIT_MS);
    }
    await sleep(WAIT_MS);

    // 7. Open deals
    console.log("[walkthrough] 7. Deals");
    await page.goto(`${BASE_URL}/deals`, { waitUntil: "domcontentloaded" });
    await sleep(NAV_WAIT_MS);

    // 8. Start Deal — open in modal if link present (intercepting route)
    const startDealLink = page.getByRole("link", { name: /start deal|new deal/i }).first();
    if (await startDealLink.isVisible().catch(() => false)) {
      await startDealLink.click();
      await sleep(WAIT_MS);
      await page.keyboard.press("Escape");
      await sleep(WAIT_MS);
    }

    // 9. Delivery queue
    console.log("[walkthrough] 9. Delivery queue");
    await page.goto(`${BASE_URL}/deals/delivery`, { waitUntil: "domcontentloaded" });
    await sleep(NAV_WAIT_MS);

    // 10. Return to dashboard
    console.log("[walkthrough] 10. Back to dashboard");
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "domcontentloaded" });
    await sleep(NAV_WAIT_MS);
  } finally {
    // Video is per-page in Playwright; get reference before closing context
    const video = page.video();
    await context.close();
    await sleep(500);
    if (video) {
      try {
        const videoPath = await video.path();
        if (videoPath && fs.existsSync(videoPath)) {
          fs.renameSync(videoPath, RAW_VIDEO);
          console.log("[walkthrough] Video saved to", RAW_VIDEO);
        }
      } catch {
        // path() can fail in some environments; fall back to finding .webm in dir
      }
    }
    if (!fs.existsSync(RAW_VIDEO) && fs.existsSync(OUT_DIR)) {
      const files = fs.readdirSync(OUT_DIR);
      const webm = files.find((f) => f.endsWith(".webm"));
      if (webm) {
        fs.renameSync(path.join(OUT_DIR, webm), RAW_VIDEO);
        console.log("[walkthrough] Video saved to", RAW_VIDEO);
      }
    }
  }

  await browser.close();
}

async function main() {
  try {
    await runWalkthrough();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

main();
