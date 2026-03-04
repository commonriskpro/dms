# Step 4 — Performance notes

**Date:** 2025-03-04

## Top 3 safe optimizations (no behavior change)

1. **Bundle:** Avoid heavy client imports; ensure tree-shaking for recharts and large libs in dealer. Platform has smaller surface; verify no large client bundles.
2. **List endpoints:** All list routes use pagination with hard cap; avoid N+1 in Prisma (include/select). Already structured; confirm take/skip or cursor and indexes.
3. **Server-first:** Platform and dealer use server components and server auth; no duplicate client fetch when server already provides data. Verify login and post-login redirect do not trigger redundant RSC fetches.

## Build performance

- Contracts build first (Vercel and local); then app. Deterministic.
- Platform uses custom Prisma output (platform-client) to avoid conflict with dealer client.

## Deferred

- Turborepo was reverted; no change unless new blocker.
- No large client bundle analysis run this session; recommend after builds pass.
