/**
 * Demo pipeline — generate narration script for the demo video.
 * Writes demo-output/script.txt.
 */

import path from "path";
import fs from "fs";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "demo-output");
const SCRIPT_PATH = path.join(OUT_DIR, "script.txt");

const SCRIPT = `Intro

Welcome to the DMS dealer platform. This short walkthrough shows how your team manages inventory, leads, and deals from one place.

Dashboard overview

From the dashboard you get a single view of what matters: today's tasks, inventory health, and pipeline activity. KPIs and widgets are configurable so each role sees what they need.

Inventory workflow

In Inventory we keep the full lifecycle of every unit. From the list you can filter by status, age, or missing photos. Adding a vehicle is one click: open Add Vehicle and fill in VIN or details. The system supports draft vehicles, recon tracking, and photo workflows so nothing slips.

CRM pipeline

The CRM pipeline is where leads become opportunities. Stages like New Lead, Contacted, Appointment, and Working Deal keep everyone aligned. Move opportunities between stages as you progress; the board view makes it easy to see workload and next actions.

Deal desk

Deal Desk is the hub for structured deals. Open any deal to see numbers, fees, trades, and finance. Status flows from draft to contracted; once contracted, financials are locked and the deal moves to funding and delivery.

Delivery workflow

The delivery queue shows deals ready for delivery and those already delivered. You can track title status, DMV checklist, and funding in one place. When everything is complete, mark the deal delivered and close the loop.

Closing

That's the core flow: dashboard to inventory, CRM pipeline, deal desk, and delivery. One system for the full deal lifecycle. Thanks for watching.
`;

export function generateScript(): void {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }
  fs.writeFileSync(SCRIPT_PATH, SCRIPT.trim(), "utf-8");
  console.log("[generate-script] Wrote", SCRIPT_PATH);
}

function main() {
  generateScript();
}

main();
