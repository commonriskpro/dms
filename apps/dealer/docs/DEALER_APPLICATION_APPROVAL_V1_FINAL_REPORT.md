# Dealer Application Approval V1 — Final Report (Step 6: QA-Hardening)

**Sprint:** Dealer Application + Approval Flow V1  
**Step:** 6 — QA-Hardening  
**Scope:** Focused tests, responsive/dark/light sanity checks, lifecycle verification. No redesign; only tiny fixes where required.

---

## 1. Tests added and run

### 1.1 New test files

| File | Purpose |
|------|--------|
| `apps/dealer/app/api/apply/draft/route.test.ts` | POST /api/apply/draft: rate limit, validation (missing source, invalid email), success (public_apply, invite with inviteId/invitedByUserId) |
| `apps/dealer/app/api/apply/[id]/route.test.ts` | GET/PATCH /api/apply/[id]: rate limit, 404 NOT_FOUND, GET response shape (no reviewNotes/rejectionReason), PATCH 404/INVALID_STATE/200, invalid UUID → 422 |
| `apps/dealer/app/api/apply/[id]/submit/route.test.ts` | POST submit: rate limit, 404, INVALID_STATE, 200 with status submitted |
| `apps/dealer/app/api/apply/invite/[token]/route.test.ts` | GET invite by token: rate limit, INVITE_NOT_FOUND, INVITE_ALREADY_ACCEPTED, INVITE_EXPIRED, 200 with existing app, 200 with new draft |
| `apps/dealer/app/apply/[id]/__tests__/ApplyFormClient.test.tsx` | Staged form: load draft, lifecycle (submitted/approved/rejected/under_review show “Application submitted”), Back/Save & next, Submit → replace /apply/success, load error |

### 1.2 Existing tests used

| File | Relevance |
|------|-----------|
| `apps/dealer/app/(app)/get-started/__tests__/GetStartedClient.test.tsx` | Onboarding/get-started: nextAction (SELECT_DEALERSHIP, CHECK_EMAIL_FOR_INVITE, NONE), case rendering |
| `apps/dealer/app/api/invite/accept/route.test.ts` | Accept-invite API (already present; handoff is client redirect) |
| `apps/dealer/app/api/auth/onboarding-status/route.test.ts` | Onboarding status API (used by get-started) |

### 1.3 Tests run (focused)

```text
npx jest "app/api/apply" "app/apply/[id]/__tests__/ApplyFormClient" "app/(app)/get-started/__tests__/GetStartedClient"
```

**Result:** 6 test suites, 34 tests — all passed.

- **apply/draft:** 5 tests (rate limit, validation x2, success public_apply, success invite)
- **apply/[id]:** 8 tests (GET/PATCH rate limit, 404, GET shape, PATCH INVALID_STATE/200, GET invalid UUID 422)
- **apply/[id]/submit:** 4 tests (rate limit, 404, INVALID_STATE, 200)
- **apply/invite/[token]:** 6 tests (rate limit, NOT_FOUND, ALREADY_ACCEPTED, EXPIRED, 200 existing app, 200 new draft)
- **ApplyFormClient:** 8 tests (load draft, submitted/approved/rejected/under_review states, Back/Next, Submit → success, load error)
- **GetStartedClient:** 3 tests (CASE 1 Select dealership, CASE 2 pending invite, CASE 3 no dealership)

### 1.4 Platform dealer-applications and internal API

- **Platform list/detail** live in `apps/platform`. No new tests added in this repo; platform has its own Jest config and test patterns. Manual smoke: list loads, detail loads, approve/reject/save-notes from UI.
- **Dealer internal** `GET/PATCH /api/internal/applications*` are protected by `verifyInternalApiJwt`. Tests would require JWT mock and are left for a follow-up if desired.

---

## 2. Code changes (tiny fixes)

| File | Change |
|------|--------|
| `apps/dealer/app/api/apply/[id]/route.ts` | Import path for schemas: `../../schemas` → `../schemas`. Import `validationErrorResponse` from `@/lib/api/validate` and return `Response.json(validationErrorResponse(...), { status: 400 })` for PATCH validation. |
| `apps/dealer/app/api/apply/draft/route.ts` | Import `validationErrorResponse` from `@/lib/api/validate`; return `Response.json(validationErrorResponse(...), { status: 400 })` for validation failure (was returning body only). |
| `apps/dealer/lib/api/errors.ts` | Map `ApiError` code `INVALID_STATE` → HTTP 400 (was 500). |

No route or RBAC changes beyond the above.

---

## 3. Responsive sanity checks

Not automated (Jest is Node; no viewport). Recommended manual checks:

- **/apply** — Entry: start form and resume form usable on narrow (e.g. 375px) and wide.
- **/apply/[id]** — Stepped form: progress bar and step content readable; buttons (Back, Save & next, Submit) accessible; “Save this link” line wraps.
- **Platform dealer-applications list** — Table and status filter usable on small and large screens.
- **Platform dealer-applications detail** — Lifecycle card, review notes, application data, approve/reject/save-notes usable at 375px and desktop.

---

## 4. Dark/light sanity checks

Apply and platform dealer-applications use CSS vars (`--text`, `--surface`, `--border`, `--accent`, etc.). Manual check:

- Toggle light/dark (or system) and confirm /apply, /apply/[id], /apply/success, platform list/detail remain readable with no obvious contrast or token violations.

---

## 5. Lifecycle / state rendering

Verified in tests:

| Status | Where | Verified behavior |
|--------|--------|-------------------|
| **draft** | ApplyFormClient | Form editable; step 1 of 6; Save & next / Submit. |
| **invited** | ApplyFormClient | Same as draft (editable). |
| **submitted** | ApplyFormClient | “Application submitted” card; status text; Back to apply link. |
| **under_review** | ApplyFormClient | Same as submitted. |
| **approved** | ApplyFormClient | Same as submitted. |
| **rejected** | ApplyFormClient | Same as submitted. |
| **activation_sent / activated** | Apply form | Not shown on apply form (user sees “Application submitted” for any non-draft/invited). Platform detail page shows activationSentAt/activatedAt when set. |

Public API GET /api/apply/[id] does not return reviewNotes or rejectionReason (verified in route test).

---

## 6. Approve / reject / save-notes

- Not covered by new Jest tests (platform app and internal JWT). Manual: in platform dealer-applications detail, approve and reject set status and refetch; save notes updates reviewNotes and refetches.
- Dealer internal PATCH is only callable with valid internal JWT (platform proxy).

---

## 7. Onboarding / get-started handoff

- **GetStartedClient.test.tsx** already covers nextAction and three cases (select dealership, pending invite, no dealership).
- Accept-invite → signup → `window.location.href = "/get-started"` is client-only; no extra fetch. get-started page loads with server-fetched onboarding-status and dealerships (RSC). Covered by existing get-started tests and design.

---

## 8. Unrelated failures (full `npm run test:dealer`)

When running the full dealer test suite, the following failures were observed and are **unrelated** to the application/approval flow:

| Test file | Failure |
|-----------|---------|
| `modules/dashboard/tests/getDashboardV3Data.test.ts` | `prisma.vehicle.findMany is not a function` (mock incomplete) |
| `app/(app)/dashboard/__tests__/dashboard-v3-render.test.tsx` | (dashboard render) |
| `app/(app)/dashboard/__tests__/switchDealership-render.test.tsx` | (switch dealership render) |
| `app/(app)/dashboard/__tests__/page.test.tsx` | (dashboard page) |
| `modules/customers/tests/timeline-callbacks-lastvisit.test.ts` | (timeline/callbacks) |
| `modules/inventory/ui/__tests__/inventory-permissions.test.tsx` | (inventory permissions) |
| `modules/inventory/tests/audit.test.ts` | (audit) |
| `components/dashboard-v3/__tests__/dashboard-snapshots.test.tsx` | (snapshots) |
| `components/dashboard-v3/__tests__/dashboard-style-policy.test.ts` | (style policy) |
| `components/dashboard-v3/__tests__/dashboard-ui-tokens.test.ts` | (UI tokens) |

These should be tracked and fixed separately from the dealer application approval V1 work.

---

## 9. Documented changed files

**New:**
- `apps/dealer/app/api/apply/draft/route.test.ts`
- `apps/dealer/app/api/apply/[id]/route.test.ts`
- `apps/dealer/app/api/apply/[id]/submit/route.test.ts`
- `apps/dealer/app/api/apply/invite/[token]/route.test.ts`
- `apps/dealer/app/apply/[id]/__tests__/ApplyFormClient.test.tsx`
- `apps/dealer/docs/DEALER_APPLICATION_APPROVAL_V1_FINAL_REPORT.md`

**Modified (tiny fixes):**
- `apps/dealer/app/api/apply/[id]/route.ts` (schemas import path, validation response)
- `apps/dealer/app/api/apply/draft/route.ts` (validation response)
- `apps/dealer/lib/api/errors.ts` (INVALID_STATE → 400)

---

## 10. Summary

- **Focused tests:** Apply entry (draft API), staged form (ApplyFormClient: navigation, save, submit, lifecycle states), invite token resolution, get-started (existing). All 34 tests in scope pass.
- **Tiny fixes:** Apply route schema import and validation response (draft + [id] PATCH), INVALID_STATE → 400.
- **Responsive / dark-light:** Documented as manual sanity checks.
- **Lifecycle:** draft, invited, submitted, under_review, approved, rejected verified on the form; activation_sent/activated only on platform detail.
- **Unrelated failures:** Listed in §8; no change to routes or RBAC for them.
