/**
 * Prepares the local stage to run the demo pipeline.
 * Run from repo root: npm run prepare-demo
 *
 * 1. Ensures .env.local exists (copies from .env.local.example if missing).
 * 2. Generates DEMO_USER_EMAIL and DEMO_USER_PASSWORD and writes them to .env.local (no manual step).
 * 3. Prisma generate (dealer).
 * 4. DB migrate (dealer).
 * 5. DB seed (base permissions + demo dealership).
 * 6. Create demo login (Supabase user + link to demo dealership).
 * 7. Playwright install chromium.
 */

import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import { randomBytes } from "crypto";

const ROOT = process.cwd();
const ENV_LOCAL = path.join(ROOT, ".env.local");
const ENV_LOCAL_EXAMPLE = path.join(ROOT, ".env.local.example");

const DEMO_EMAIL = "demo@local.dms";

/** Generate a password that satisfies policy: 12+ chars, 3+ of upper/lower/digit/symbol. */
function generateDemoPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digit = "23456789";
  const symbol = "!@#$%&*";
  const oneOf = (s: string) => s[randomBytes(1)[0]! % s.length]!;
  const part = oneOf(upper) + oneOf(lower) + oneOf(digit) + oneOf(symbol);
  const rest = upper + lower + digit;
  let out = part;
  for (let i = 0; i < 10; i++) out += rest[randomBytes(1)[0]! % rest.length]!;
  return out
    .split("")
    .sort(() => (randomBytes(1)[0]! % 2 === 0 ? 1 : -1))
    .join("");
}

/** Update or append DEMO_USER_EMAIL and DEMO_USER_PASSWORD in .env.local. */
function writeDemoCredentialsToEnvLocal(email: string, password: string): void {
  let content = fs.existsSync(ENV_LOCAL) ? fs.readFileSync(ENV_LOCAL, "utf-8") : "";
  const lines = content.split("\n");
  const out: string[] = [];
  let hasEmail = false;
  let hasPassword = false;
  for (const line of lines) {
    if (/^\s*DEMO_USER_EMAIL\s*=/.test(line)) {
      out.push(`DEMO_USER_EMAIL=${email}`);
      hasEmail = true;
      continue;
    }
    if (/^\s*DEMO_USER_PASSWORD\s*=/.test(line)) {
      out.push(`DEMO_USER_PASSWORD=${password}`);
      hasPassword = true;
      continue;
    }
    out.push(line);
  }
  if (!hasEmail) out.push(`DEMO_USER_EMAIL=${email}`);
  if (!hasPassword) out.push(`DEMO_USER_PASSWORD=${password}`);
  fs.writeFileSync(ENV_LOCAL, out.join("\n").trimEnd() + "\n", "utf-8");
}

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: ROOT,
      stdio: "inherit",
      shell: true,
      env: process.env,
    });
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`Command failed: ${cmd} ${args.join(" ")}`))));
  });
}

function main() {
  console.log("=== Prepare local stage for demo ===\n");

  if (!fs.existsSync(ENV_LOCAL)) {
    if (!fs.existsSync(ENV_LOCAL_EXAMPLE)) {
      console.error(".env.local.example not found. Cannot create .env.local.");
      process.exit(1);
    }
    fs.copyFileSync(ENV_LOCAL_EXAMPLE, ENV_LOCAL);
    console.log("Created .env.local from .env.local.example.");
    console.log("Fill in DATABASE_URL and Supabase keys (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY), then run:");
    console.log("  npm run prepare-demo\n");
    process.exit(0);
  }

  const password = generateDemoPassword();
  writeDemoCredentialsToEnvLocal(DEMO_EMAIL, password);
  console.log("Generated demo credentials and wrote to .env.local:");
  console.log(`  DEMO_USER_EMAIL=${DEMO_EMAIL}`);
  console.log(`  DEMO_USER_PASSWORD=<generated>\n`);

  const steps: Array<{ name: string; cmd: string; args: string[] }> = [
    { name: "Prisma generate (dealer)", cmd: "npm", args: ["run", "prisma:generate:dealer"] },
    { name: "DB migrate (dealer)", cmd: "npm", args: ["run", "db:migrate"] },
    { name: "DB seed (base + demo dealership)", cmd: "npm", args: ["run", "db:seed"] },
    { name: "Create demo login", cmd: "npm", args: ["run", "demo:create-login", "--prefix", "apps/dealer"] },
    { name: "Playwright install chromium", cmd: "npx", args: ["playwright", "install", "chromium"] },
  ];

  (async () => {
    for (const step of steps) {
      console.log(`Step: ${step.name}`);
      await run(step.cmd, step.args);
      console.log("");
    }
    console.log("=== Local stage ready. Run: npm run generate-demo ===\n");
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

main();
