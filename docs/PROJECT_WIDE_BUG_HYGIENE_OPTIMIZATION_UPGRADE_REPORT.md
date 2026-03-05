# Project-Wide Bug, Hygiene, Optimization & Upgrade Report

**Generated:** 2026-03-05  
**Scope:** DMS monorepo (apps/dealer, apps/platform, packages/*)

---

## 1) Executive Summary

### Top 10 Issues (by severity)

| Rank | Severity | Issue | Location / note |
|------|----------|--------|-------------------|
| 1 | **P0** | Dealer Jest snapshot test failing (MetricCard UI changed) | `apps/dealer/components/dashboard-v3/__tests__/dashboard-snapshots.test.tsx` |
| 2 | **P0** | Prisma EPERM on dealer full build (Windows file lock) | `prisma generate` in apps/dealer; blocks `npm -w apps/dealer run build` when client is locked |
| 3 | **P1** | Next.js workspace root / output tracing warning (both apps) | No `outputFileTracingRoot` (dealer) / `turbopack.root` (platform) in next.config |
| 4 | **P1** | Prisma 7 generator output path deprecation (dealer) | `apps/dealer/prisma/schema.prisma` — no `output` on generator |
| 5 | **P1** | Lint fails: "Invalid project directory provided, no such directory: .../lint" | Both apps when running `next lint` (Next 16 / npm -w interaction) |
| 6 | **P1** | Tailwind palette usage in dealer UI (token-only rule) | Multiple files use `bg-blue-100`, `text-amber-600`, `border-amber-200`, etc. |
| 7 | **P2** | React NaN `children` in test (inventory permissions) | `Received NaN for the children attribute` in `inventory-permissions.test.tsx` |
| 8 | **P2** | React `act()` warnings in SegmentedJourneyBar test | State updates not wrapped in `act()` in `SegmentedJourneyBar.test.tsx` |
| 9 | **P2** | Supabase RealtimeClient critical dependency warning (dealer build) | webpack: "the request of a dependency is an expression" via `@supabase/realtime-js` |
| 10 | **P2** | Duplicate import in CustomersFilterSearchBar | `apiFetch` and `getApiErrorMessage` imported in two lines from same module |

### Build status summary

| App | Full build | Next-only build | Tests | Lint |
|-----|------------|-----------------|-------|------|
| **dealer** | ❌ (Prisma EPERM) | ✅ (with warnings) | ❌ 1 snapshot fail | ❌ (invalid dir) |
| **platform** | ✅ | N/A | ✅ 123 passed | ❌ (invalid dir) |

### What to fix next (priority order)

1. **Update or relax dashboard snapshot test** so dealer test suite passes (no business logic change).
2. **Add Prisma generator `output` in dealer schema** and (optional) add `outputFileTracingRoot` / `turbopack.root` in both Next configs to silence warnings.
3. **Fix `next lint` invocation** (run from app directory or adjust script so Next 16 does not receive "lint" as directory).
4. **Replace Tailwind palette classes in dealer UI** with CSS variables / token-only classes per project rules.
5. **Address test hygiene:** NaN children in inventory test, act() in SegmentedJourneyBar test.
6. **Merge duplicate import** in `CustomersFilterSearchBar.tsx` (low-risk).

---

## 2) Build / Tooling Health

### Next.js build warnings

- **Dealer (next build --webpack):**
  - **Workspace root:**  
    `Warning: Next.js inferred your workspace root, but it may not be correct. We detected multiple lockfiles... To silence this warning, set outputFileTracingRoot in your Next.js config...`  
    **Cause:** Monorepo with lockfile at repo root and possible parent lockfile (e.g. `C:\dev\package-lock.json`).  
    **Fix:** In `apps/dealer/next.config.mjs` add `outputFileTracingRoot: path.join(__dirname, '../..')` (and use `path` from `path` / `fileURLToPath`).
  - **Supabase RealtimeClient:**  
    `Critical dependency: the request of a dependency is an expression` — from `@supabase/realtime-js` → `@supabase/supabase-js` → `lib/supabase/service.ts` → `modules/core-platform/service/file.ts` → `app/api/files/signed-url/route.ts`.  
    **Cause:** Dynamic require/import in Supabase dependency.  
    **Fix:** Optional webpack `externals` or accept warning; no functional fix required for server-side file usage.

- **Platform (next build):**
  - **Turbopack root:**  
    `We detected multiple lockfiles... set turbopack.root in your Next.js config...`  
    **Fix:** In `apps/platform/next.config.js` set `turbopack: { root: path.join(__dirname, '../..') }` (with `path` and `__dirname`).

### TypeScript status

- No TypeScript errors reported during dealer or platform builds; both complete "Running TypeScript..." successfully.

### Lint status

- **Observed:**  
  `next lint` fails with:  
  `Invalid project directory provided, no such directory: C:\dev\dms\apps\dealer\lint` (and similarly for platform).  
- **Cause:** Likely Next 16 CLI treating an argument as directory when run via `npm -w apps/dealer run lint` (script: `next lint`).  
- **Recommendation:** Run lint from inside the app directory: `cd apps/dealer && npx next lint`. If that works, add a root script that `cd`s into the app and runs `next lint`, or document that lint must be run from app dir. No Next 16–specific lint quirks identified beyond this.

### Test status (Jest)

- **Dealer:** One failing suite: `components/dashboard-v3/__tests__/dashboard-snapshots.test.tsx` — "MetricCard matches snapshot (uses token classes)". Snapshot diff shows intentional UI changes (MetricCard layout, focus ring, shadows, icon structure). All other suites pass. Console warnings: logger output in tests, NaN children in inventory-permissions test, act() warnings in SegmentedJourneyBar test.
- **Platform:** All 30 suites pass (123 tests). Console output from `lib/logger.ts` and `lib/api-handler.ts` in tests (expected in test runs).

### Prisma warnings

- **Dealer:**  
  `Warning: You did not specify an output path for your generator in schema.prisma. This behavior is deprecated and will no longer be supported in Prisma 7.0.0.`  
  **Fix:** In `apps/dealer/prisma/schema.prisma`, add to generator block:  
  `output = "../../node_modules/.prisma/dealer-client"` (or a path under `apps/dealer` if preferred and consistent with imports).
- **Platform:** Generator already has `output = "../../node_modules/.prisma/platform-client"` — no warning.

---

## 3) Bug & Error Scan

### Merge conflict markers

- **Grep:** `<<<<<<<`, `=======`, `>>>>>>>` in `*.ts`, `*.tsx`, `*.js`, `*.jsx`, `*.json`, `*.md`.  
- **Result:** No matches. No merge conflict markers in codebase.

### Dead code / TODO-FIXME hotspots

- **TODO/FIXME (non-spec):** All concentrated in inventory module, tied to “Step 4” cleanup:
  - `apps/dealer/modules/inventory/ui/ListPage.tsx`: "TODO: remove fallback after Step 4" (projectedGrossCents).
  - `apps/dealer/modules/inventory/ui/types.ts`: multiple `@deprecated` + "TODO: remove fallback after Step 4" (salePriceCents, auctionCostCents, reconCostCents, miscCostCents, etc.).
  - `apps/dealer/modules/inventory/ui/AgingPage.tsx`: "TODO: remove fallback after Step 4" (salePriceCents).
- **Impact:** Technical debt; no immediate bug. Plan removal when Step 4 is complete.

### Runtime error patterns

- **Try/catch and promise handling:**  
  - Many client components use `.catch((e) => setError(...))` or `.catch(() => setX([]))` with user-visible error state or fallback — acceptable.  
  - `res.json().catch(() => ({}))` used in platform and dealer to avoid throw on non-JSON response — reasonable.  
  - No systematic “swallowed” errors that hide security or data integrity issues identified.  
- **Server:** `lib/api-handler.ts` and `lib/events.ts` log and rethrow or return error responses; audit/logger use `console.error` for write failures — acceptable for ops.

### Incorrect imports / exports

- **CustomersFilterSearchBar:** Two separate imports from `@/lib/client/http`: `apiFetch` and `getApiErrorMessage`. Merge to a single import.  
- **Shadcn/barrel:** No missing `DropdownMenuTrigger` or other wrapper exports detected; dropdown and dialog usage in CustomersFilterSearchBar and SaveSearchDialog use correct imports.

### Suspicious logic

- **NaN children:** Test output "Received NaN for the `children` attribute" in `modules/inventory/ui/__tests__/inventory-permissions.test.tsx`. Suggests a component (likely in DetailPage or a child) is rendering a numeric value that is NaN when permissions are denied or data is empty. **Recommendation:** Track down the prop that becomes NaN (e.g. a count or metric) and guard with `Number.isFinite(x) ? x : 0` or avoid rendering the number when invalid.
- **ModalShell:** When `error` is set and `children` is omitted, the component correctly shows a default error body; no bug found.

---

## 4) Security & Abuse-Resistance Quick Audit (non-invasive)

### Tenant isolation (dealership_id scoping)

- **Pattern:** Dealer API routes use `getAuthContext(request)`, which resolves `dealershipId` from session/cookie and membership (no cross-tenant bypass). Service and DB layers receive `dealershipId` and scope queries (e.g. `where: { dealershipId }`).  
- **Grep:** `dealershipId` / `dealership_id` appears in a large number of dealer API route files in `app/api` — consistent with tenant-scoped access.  
- **Gap:** No automated audit of “every read/write path includes dealershipId” was run; recommend Security-QA add tenant-isolation tests for new modules.

### RBAC enforcement at route boundaries

- **Pattern:** `getAuthContext()` loads permissions; routes call `requirePermission("resource.action")` (from `@/lib/rbac`) before business logic. Handler pattern: getAuthContext → requirePermission → parse input → service call.  
- **Grep:** Many routes in `app/api` use `getAuthContext`; `requirePermission` is used in handler layer.  
- **Recommendation:** Keep RBAC at route boundary; ensure every mutation and sensitive read has a documented permission and a negative test (e.g. 403 when permission missing).

### Zod validation coverage

- **Present:** CRM routes use shared schemas in `app/api/crm/schemas.ts`; customers, admin memberships, search, inventory photos, reports, invite resolve, etc. use Zod for params/query/body.  
- **Gap:** Not every route was audited; some older or internal routes may parse params/body manually. **Recommendation:** Per Thin Gates, add Zod for params/query/body at the edge for any route that was not yet updated; track in a small “Zod coverage” list.

### Rate limit coverage

- **Covered:** Invite accept/resolve, auth session switch, platform invites, files upload, documents upload, inventory photos upload, reports export, customers list (create/list), platform provision/invite-owner/onboarding-status. Internal dealer routes use `checkInternalRateLimit`.  
- **Recommendation:** Ensure any new public or sensitive endpoint (e.g. password reset, signup) gets rate limiting.

### File upload endpoints

- **Pattern:** Rate limiting applied; file size passed to service (`file.size`); document upload validation tests cover mime, size, path, and schema.  
- **Gap:** No single constant (e.g. `MAX_UPLOAD_BYTES`) was found in a quick scan; size limits may be enforced in service or storage layer. **Recommendation:** Document max size and content-type allowlist in one place (e.g. docs or env) and enforce in route or service.

### Logging hygiene

- **PII/tokens:** Platform `lib/api-handler.ts` logs error message and stack on unexpected errors; test that throws with `database_url=... token=...` in message shows that sensitive strings can appear in logs if included in `err.message`. **Recommendation:** Redact known secret patterns (e.g. `token=`, `password=`, `authorization:`) in log payloads.  
- **Stack traces:** Logged in development/unexpected paths; ensure production logs do not expose full stack to client.  
- **Audit:** Audit log writes use dedicated module; no evidence of logging raw PII in audit payloads.

---

## 5) Code Hygiene & Maintainability

### Consistency (folder structure, naming, service boundaries)

- **Dealer:** Follows `/modules/<name>/{ui,service,db,tests}` and routes under `app/api/**`; shared components under `components/**`. Aligned with DMS rules.  
- **Platform:** Uses `lib/*` for services; no forced refactor to `/modules` per rules.  
- **Naming:** Consistent use of `dealershipId`, camelCase in TS, snake_case in DB/Prisma.

### Duplicate utilities / repeated patterns

- **Status badge styling:** Same pattern repeated for status → Tailwind classes (e.g. `bg-blue-100 text-blue-800`, `bg-amber-100 text-amber-800`) in:
  - `modules/crm-pipeline-automation/ui/JobsPage.tsx`
  - `modules/finance-shell/ui/DealFinanceTab.tsx`
  - `modules/lender-integration/ui/DealLendersTab.tsx`
  - `modules/deals/ui/ListPage.tsx`, `DetailPage.tsx`
  - `modules/crm-pipeline-automation/ui/OpportunitiesTablePage.tsx`, `OpportunityDetailPage.tsx`
- **Recommendation:** Extract a small `StatusBadge` (or token-based variant map) and use token classes only; removes duplication and palette drift.

### UI design system drift (Tailwind palette vs token-only)

- **Rule:** No Tailwind palette colors in dealer UI; token-only.  
- **Offenders (dealer):** See Appendix — palette class offenders list. Files include JobsPage, DealFinanceTab, DealLendersTab, platform dealerships pages (dealer app), closed-screen, DetailPage (customers/deals), ListPage (deals), OpportunityDetailPage, InvitesPage, UsersPage, and test file referencing forbidden classes.

### Server/client boundaries

- **"use client":** Many files (154+ in apps) use "use client" for interactivity (forms, modals, tables, context). No obvious “should be server” components identified without deeper per-page review.  
- **Fetch-on-mount:** CustomersPageClient, CreateCustomerPage, and similar receive initial data from server and use client state for filters/pagination; some list pages fetch on mount for secondary data (e.g. members, options). Prefer server-loaded initial data and avoid fetch-on-mount for above-the-fold content where possible.

### Modal architecture

- **App layout:** `app/(app)/layout.tsx` uses `AppShell` and `{modal}` slot; no ModalShell in layout. ModalShell is used inside feature modals (e.g. SaveSearchDialog, ManageSearchesDialog). Compliant with “AppShell only in app/(app)/layout” and modal slot pattern.

---

## 6) Performance & UX Optimization Audit

### RSC/CSR split and router.refresh()

- **Usage:** `router.refresh()` is used after filter change, page change, saved search/filter apply, and after create (e.g. CreateCustomerPage). This refreshes the full RSC tree for the current route.  
- **Impact:** Correct for “URL + server state changed” (e.g. customers list params). For small widget-only updates (e.g. a single card), consider server actions or client cache update instead of full refresh to reduce load.  
- **Files:** `CustomersPageClient.tsx`, `CreateCustomerPage.tsx`, `GetStartedClient.tsx`, `login/page.tsx`, `platform/dealerships` pages, `bootstrap-form.tsx`.

### Bundle and dependencies

- **Supabase:** Pulls in RealtimeClient even for server-only file usage (signed-url route); dynamic import or tree-shaking may be limited.  
- **Recharts:** Used in dealer; consider dynamic import for chart-heavy routes if needed.  
- **Large deps:** No other large bundles flagged without a full bundle report.

### Tables/lists

- **Pagination:** List endpoints use limit/offset; UI uses pagination. No unbounded lists.  
- **Virtualization:** Not in use; acceptable for current table sizes. Consider virtualization if deal/customer lists grow very large.

### Caching correctness

- **Tenant routes:** Dealer API routes that need fresh tenant data should export `dynamic = "force-dynamic"`; pages that depend on session/tenant should call `noStore()`.  
- **noStore:** Project uses `import { unstable_noStore as noStore } from "next/cache"` in server components that read session/tenant data; policy-check.mjs enforces this. No `import { noStore } from "next/cache"` found in app code.

### Server importing browser-only deps

- No cases identified where server-only route or RSC imports a browser-only module. Supabase client is used in service layer with appropriate server context.

---

## 7) Upgrade & Dependency Strategy

### Current versions (from root and workspace package.json)

- **Next.js:** 16.1.6 (override)  
- **React / React-DOM:** 19.2.4 (override)  
- **TypeScript:** ^5.6.0  
- **Prisma / @prisma/client:** 6.7.0 (override)  
- **Zod:** 3.25.76 (override)  
- **Tailwind:** ^3.4.19  
- **Jest:** ^30.0.0  
- **Supabase:** @supabase/supabase-js 2.50.0, @supabase/ssr 0.6.0  
- **Node:** 24.x, **npm:** 11.x (packageManager)

### Risky / outdated deps

- **Prisma 7:** Generator output path will be required; add `output` now to avoid breakage.  
- **Next 16:** Already in use; follow release notes for future minor/patch.  
- **React 19:** In use; no known blockers.  
- **Supabase:** 2.50.0 current; check release notes for auth/storage changes before minor upgrades.

### Monorepo and lockfile

- **Recommendation:** Keep single lockfile at repo root; run all installs from root (`npm ci`). Workspace scripts run with `-w` from root. Avoid nested installs.  
- **Vercel:** Use `npm ci` and same Node/npm version as local; ensure `outputFileTracingRoot` (and platform `turbopack.root`) point to repo root so tracing and builds match.

### Upgrade roadmap (phased)

| Phase | Action | When |
|-------|--------|------|
| **Safe now** | Add Prisma generator `output` in dealer schema | Before Prisma 7 |
| **Safe now** | Add `outputFileTracingRoot` (dealer) and `turbopack.root` (platform) in Next config | Next sprint |
| **Safe now** | Replace dealer UI palette classes with tokens; consolidate status badge styling | As part of UI pass |
| **Later** | Prisma 7 upgrade (after output path and any breaking notes) | When stable |
| **Later** | Next 16.x latest patch (security/stability only) | Per release notes |
| **Later** | Supabase minor upgrade (e.g. 2.51+) after testing auth and storage | Planned maintenance |

---

## 8) Appendices

### A) Grep results summary

| Search | Scope | Result |
|--------|--------|--------|
| Merge conflict markers `<<<<<<<` etc. | Repo-wide *.ts, *.tsx, *.js, *.jsx, *.json, *.md | 0 matches |
| TODO / FIXME / HACK | *.ts, *.tsx (apps/packages) | 14 matches (inventory module + 1 ListPage) |
| console.log / .warn / .error / .info | apps *.ts, *.tsx (excl. scripts) | Multiple: logger, error handlers, audit, platform login auth_debug, tests |
| "use client" | apps | 154+ files |
| router.refresh | *.ts, *.tsx | 12 call sites (see Section 6) |
| noStore / unstable_noStore | Repo | Correct: `unstable_noStore as noStore` in pages; policy-check enforces |

### B) Palette class offenders (dealer UI only)

Files under `apps/dealer` that use Tailwind palette classes (e.g. `bg-*-*`, `text-*-*`, `border-*-*` with slate/gray/blue/amber/green/red etc.):

- `modules/crm-pipeline-automation/ui/JobsPage.tsx` — bg-blue-100, text-blue-800, bg-green-100, text-green-800, bg-amber-100, text-amber-800, bg-red-100, text-red-800
- `modules/finance-shell/ui/DealFinanceTab.tsx` — bg-blue-100, text-blue-800, bg-amber-*, border-amber-*, text-amber-*, bg-green-100, text-green-800, bg-red-100, text-red-800
- `modules/lender-integration/ui/DealLendersTab.tsx` — same pattern; border-amber-200, bg-amber-50, text-amber-900, border-red-200, bg-red-50, text-red-900
- `app/platform/dealerships/[id]/page.tsx` — border-red-200, bg-red-50, text-red-800; text-amber-600, text-green-600
- `app/platform/dealerships/page.tsx` — text-amber-600, text-green-600
- `components/closed-screen.tsx` — hover:bg-slate-200
- `modules/deals/ui/ListPage.tsx` — bg-blue-100, text-blue-800, etc.
- `modules/deals/ui/DetailPage.tsx` — same + border-amber-200, bg-amber-50, text-amber-900
- `modules/crm-pipeline-automation/ui/OpportunitiesTablePage.tsx` — bg-blue-100, text-blue-800, bg-green-100, text-green-800
- `modules/crm-pipeline-automation/ui/OpportunityDetailPage.tsx` — bg-blue-100, text-blue-800, bg-green-100, text-green-800
- `modules/customers/ui/DetailPage.tsx` — hover:bg-slate-200
- `app/platform/invites/page.tsx` — text-amber-600
- `app/platform/users/page.tsx` — text-amber-600
- `components/dashboard-v3/__tests__/dashboard-ui-tokens.test.ts` — comment only (forbidden list)

### C) Files changed (safe fixes applied this run)

- **None.** This report is report-only. No automated code changes were applied. Recommended low-risk fixes (Prisma output path, Next config tracing root, duplicate import merge) can be applied in a follow-up change.

---

## Prioritized backlog checklist (by owner)

| # | Task | Owner |
|---|------|--------|
| 1 | Update dashboard snapshot test or snapshot (MetricCard) so dealer tests pass | Frontend |
| 2 | Add Prisma generator `output` in dealer schema | Backend |
| 3 | Add `outputFileTracingRoot` (dealer) and `turbopack.root` (platform) in Next config | Backend / DevOps |
| 4 | Fix or document `next lint` (run from app dir or adjust script) | Frontend / DevOps |
| 5 | Replace Tailwind palette classes in dealer UI with token-only (see Appendix B) | Frontend |
| 6 | Fix NaN children in inventory-permissions test; wrap SegmentedJourneyBar state updates in act() | Frontend |
| 7 | Merge duplicate import in CustomersFilterSearchBar | Frontend |
| 8 | Extract status badge to shared component with token classes; use in Jobs, Deals, Finance, Lenders, CRM | Architect / Frontend |
| 9 | Audit Zod coverage for all dealer API routes (params/body/query); add where missing | Backend |
| 10 | Document and enforce max upload size + content-type allowlist for file/document uploads | Backend / Security-QA |
| 11 | Redact secret patterns in platform API error logging (message/stack) | Security-QA |
| 12 | Tenant-isolation and RBAC tests for new modules; rate-limit new sensitive endpoints | Security-QA |
| 13 | Phased upgrade: Prisma 7, Next 16 patch, Supabase minor (see Section 7) | Architect / Backend |
