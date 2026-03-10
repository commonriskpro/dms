#!/usr/bin/env node
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = join(ROOT, "artifacts", "code-health", timestamp);
mkdirSync(outDir, { recursive: true });

const projects = [
  { name: "dealer", tsconfig: "apps/dealer/tsconfig.json" },
  { name: "platform", tsconfig: "apps/platform/tsconfig.json" },
  { name: "worker", tsconfig: "apps/worker/tsconfig.json" },
];

const falsePositiveMatchers = [
  ".next/",
  ".next/types/",
  ".next/dev/types/",
  " - default",
  " - dynamic",
  " - metadata",
  " - GET",
  " - POST",
  " - PUT",
  " - PATCH",
  " - DELETE",
  " - OPTIONS",
  " - HEAD",
  "(used in module)",
  "/dist/index.d.ts",
];

const results = [];

for (const project of projects) {
  const cmd = `npx -y ts-prune -p ${project.tsconfig}`;
  let raw = "";
  try {
    raw = execSync(cmd, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) {
    const stderr = error?.stderr?.toString?.() ?? "";
    const stdout = error?.stdout?.toString?.() ?? "";
    raw = [stdout, stderr].filter(Boolean).join("\n");
  }

  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const actionable = lines.filter(
    (line) => !falsePositiveMatchers.some((needle) => line.includes(needle))
  );

  results.push({
    project: project.name,
    tsconfig: project.tsconfig,
    totalFindings: lines.length,
    actionableFindings: actionable.length,
    actionable,
    raw: lines,
  });

  writeFileSync(join(outDir, `${project.name}.raw.txt`), raw, "utf8");
  writeFileSync(join(outDir, `${project.name}.actionable.txt`), actionable.join("\n"), "utf8");
}

const summary = {
  generatedAt: new Date().toISOString(),
  outDir,
  projects: results.map((r) => ({
    project: r.project,
    tsconfig: r.tsconfig,
    totalFindings: r.totalFindings,
    actionableFindings: r.actionableFindings,
  })),
};

writeFileSync(join(outDir, "summary.json"), JSON.stringify(summary, null, 2), "utf8");

const mdLines = [];
mdLines.push("# Dead Code Audit Summary");
mdLines.push("");
mdLines.push(`Generated: ${summary.generatedAt}`);
mdLines.push("");
for (const project of results) {
  mdLines.push(`## ${project.project}`);
  mdLines.push(`- tsconfig: \`${project.tsconfig}\``);
  mdLines.push(`- total findings: **${project.totalFindings}**`);
  mdLines.push(`- actionable findings: **${project.actionableFindings}**`);
  mdLines.push("");
  if (project.actionable.length > 0) {
    mdLines.push("Top actionable entries:");
    for (const line of project.actionable.slice(0, 30)) {
      mdLines.push(`- \`${line}\``);
    }
  } else {
    mdLines.push("No actionable findings after filtering.");
  }
  mdLines.push("");
}

const md = mdLines.join("\n");
writeFileSync(join(outDir, "summary.md"), md, "utf8");
writeFileSync(join(ROOT, "artifacts", "code-health", "latest-summary.md"), md, "utf8");
writeFileSync(
  join(ROOT, "artifacts", "code-health", "latest-summary.json"),
  JSON.stringify(summary, null, 2),
  "utf8"
);

console.log(`[code-health] dead code audit complete: ${outDir}`);
for (const p of summary.projects) {
  console.log(
    `[code-health] ${p.project}: total=${p.totalFindings} actionable=${p.actionableFindings}`
  );
}
