# Dealer Onboarding Completion — Specification

**Sprint:** Dealer Onboarding Completion  
**Step:** 1 — Architect  
**Context:** Dealer Application + Approval Flow V1 is complete. First login redirects to `/get-started`. This spec completes the **post-login onboarding journey** so a newly approved owner is guided through setup to first real use.

---

## 1. Onboarding goals

### 1.1 What “onboarding complete” means for V1

The system shall consider onboarding complete when all of the following are true:

1. **Dealership basics** — The dealership has at least a display name (and optionally address/contact). Provisioning already sets `name` and one location; we may capture a few more identity fields or confirm defaults.
2. **Owner active** — At least the owner account is active (membership exists). This is already true after activation.
3. **Team step handled** — Either the owner invited at least one teammate or explicitly skipped (“invite later”).
4. **Inventory path chosen** — The owner either added a first vehicle, started bulk import, or chose “set up inventory later.”
5. **CRM basics** — Either minimal CRM defaults are set/acknowledged or the step was skipped for later.
6. **Operations basics** — Either title/funding/delivery readiness is acknowledged or the step was skipped for later.
7. **Launch reached** — The owner has passed the final step and can enter the main app (dashboard) with a clear “first actions” handoff.

### 1.2 Outcomes

- **First-time owner:** Lands on get-started → staged onboarding → completion → dashboard (or first action).
- **Returning owner (incomplete):** Can resume from last step or “continue setup later” and still use the app where allowed.
- **Non-owner (invited member):** Does not see full onboarding; may see “select dealership” only if they have no active dealership. No mandatory setup steps for non-owners in V1.

---

## 2. Onboarding flow structure

### 2.1 Staged steps (exact order)

| Step | Name              | Purpose |
|------|-------------------|--------|
| 1    | Dealership Info   | Confirm or set dealership display name, primary address/contact, timezone. |
| 2    | Team Setup        | Invite team members (or skip / “invite later”). |
| 3    | Inventory Setup   | Choose path: add first vehicle, bulk import, or skip for later. |
| 4    | CRM Basics        | Acknowledge or set minimal CRM defaults (or skip). |
| 5    | Operations Basics | Acknowledge workflow readiness (title/funding/delivery) or skip. |
| 6    | Launch            | Completion state; next-action cards; go to dashboard. |

### 2.2 Per-step definition

**Step 1 — Dealership Info**

- **Purpose:** Establish who the dealership is (name, place, contact).
- **Required:** Display name (min 1 character). Dealership already has `name` from provisioning; we allow editing and optionally primary address/phone/timezone.
- **Optional:** Address (or use primary location), phone, email, timezone, logo (if in scope).
- **Skip:** Not skippable (minimal required: confirm or set name).
- **Completion rule:** Name set (and saved). Optional fields can be empty.
- **Save/resume:** Persist to Dealership (and primary DealershipLocation if used). Resume loads current values.

**Step 2 — Team Setup**

- **Purpose:** Invite teammates so the dealership isn’t single-user only.
- **Required:** None (skip allowed).
- **Optional:** Send one or more invites (email + role).
- **Skip:** Allowed. “Invite later” or “Skip” advances to next step.
- **Completion rule:** At least one invite sent, or step skipped.
- **Save/resume:** Invites are created immediately (no draft). Resume shows “invited” state and allows sending more or skipping.

**Step 3 — Inventory Setup**

- **Purpose:** Choose how inventory will be added.
- **Required:** A choice (not empty).
- **Options:** (a) Add first vehicle now → deep link to `/inventory/new`, (b) Import inventory → link to bulk import entry, (c) Skip for later.
- **Skip:** “Skip for later” is an explicit choice.
- **Completion rule:** One of the three paths selected and recorded. If “add first vehicle,” we record “chose add” and optionally track whether they actually created one (optional for V1).
- **Save/resume:** Persist chosen path; resume shows choice and allows changing or continuing.

**Step 4 — CRM Basics**

- **Purpose:** Set or acknowledge minimal CRM setup (lead sources, pipeline).
- **Required:** None if step is skippable.
- **Optional:** Ensure default pipeline exists; optional default lead source list or “acknowledge” only.
- **Skip:** Allowed. “Set up CRM later.”
- **Completion rule:** Pipeline/defaults acknowledged or created, or step skipped.
- **Save/resume:** Persist “completed” or “skipped”; resume allows re-entry or skip.

**Step 5 — Operations Basics**

- **Purpose:** Acknowledge title/funding/delivery workflow readiness.
- **Required:** None.
- **Optional:** Short copy + “I’ve reviewed” or “Configure later.”
- **Skip:** Allowed.
- **Completion rule:** Acknowledged or skipped.
- **Save/resume:** Persist completed/skipped.

**Step 6 — Launch**

- **Purpose:** Mark onboarding complete and show first actions.
- **Required:** User must click “Finish” or “Go to dashboard.”
- **Skip:** N/A (final step).
- **Completion rule:** `onboardingCompletedAt` set; redirect to dashboard or first-action.
- **Save/resume:** N/A; completing this step sets completion.

### 2.3 Skip rules summary

- **Step 1:** Not skippable (minimal: name).
- **Steps 2, 4, 5:** Skippable with explicit “Skip” / “Later.”
- **Step 3:** “Skip for later” is one of three choices.
- **Step 6:** No skip; finish only.

---

## 3. Persistence model

### 3.1 Recommended: dedicated onboarding state

Use a **dealership-level onboarding state** table so that:

- Progress is clearly separated from core Dealership/Profile.
- We can add steps or fields without overloading Dealership.
- Completion and “continue later” are explicit.

**Proposed model: `DealershipOnboardingState`**

- `id` (UUID, PK)
- `dealershipId` (UUID, FK to Dealership, unique) — one row per dealership
- `currentStep` (int, 1–6) — last active step (1-based for UX)
- `completedSteps` (JSON array of step numbers, e.g. `[1,2]`) or separate booleans per step — which steps are done
- `skippedSteps` (JSON array, e.g. `[2,4,5]`) — which steps were skipped
- `inventoryPathChosen` (string, nullable) — `"add_first"` | `"import"` | `"later"`
- `isComplete` (boolean, default false)
- `completedAt` (DateTime, nullable)
- `createdAt`, `updatedAt`

**Alternative: dealership + settings flags**

- Store `onboardingCurrentStep`, `onboardingCompletedAt`, and step flags in `Dealership.settings` (JSON). No new table.
- **Downside:** Mixes product onboarding with generic settings; harder to query “all incomplete onboardings” and to evolve.

**Recommendation:** **Dedicated `DealershipOnboardingState`** for clarity, auditability, and future reporting. Dealership keeps `name`, `settings` (timezone, etc.); onboarding progress lives in one place and can be extended (e.g. step metadata, A/B) without touching Dealership schema.

### 3.2 Dealership data used by onboarding

- **Step 1:** Update `Dealership.name`; optionally primary `DealershipLocation` (address, etc.) and `Dealership.settings` (timezone, phone, email if we add them to settings or location).
- **Step 2:** Use existing invite/membership APIs (platform-admin invite service or dealer admin memberships); no new persistence beyond “step completed/skipped” in onboarding state.
- **Steps 3–5:** Only onboarding state (path chosen, completed/skipped).
- **Step 6:** Set `isComplete = true`, `completedAt = now()`.

### 3.3 Who has onboarding state

- **One row per dealership.** Owner and other members share the same dealership; when any user with permission updates onboarding, we update the same row. Completion applies to the dealership, not the user.

---

## 4. UX structure

### 4.1 Staged, resumable experience

- **Step rail / progress:** Visible progress (e.g. 1 of 6, 2 of 6) and a simple step indicator (dots or segments). No need to show all step titles in the rail in V1; “Step 1 of 6” plus current step name is enough.
- **Save and continue:** Each step can “Save” or “Save and continue.” Data is persisted so the user can leave and resume later.
- **Back / Next:** “Back” goes to the previous step without submitting; “Next” or “Save and continue” validates (if any), saves, and advances.
- **Skip:** Where allowed, a clear “Skip for now” or “Invite later” that marks the step skipped and advances.
- **Completion state:** Step 6 shows a short “You’re all set” (or similar) and next-action cards.
- **“Continue setup later”:** If the user leaves mid-flow (e.g. closes tab), next time they hit get-started we show the same flow and resume at `currentStep`. We do not force a full restart. Optionally, a visible “I’ll finish later” that sends them to dashboard with onboarding still incomplete (see 5.2).

### 4.2 Incomplete onboarding after login

- **Option A (recommended):** If onboarding is not complete and user has an active dealership, we still allow access to dashboard and main app. Get-started can be reached from a persistent hint (e.g. banner or link in app shell) until onboarding is complete. No hard block.
- **Option B:** Redirect to get-started whenever onboarding is incomplete until they complete or explicitly “finish later.” Option B is stricter; spec recommends **Option A** so we don’t strand users, and use a soft prompt to return to get-started.

### 4.3 Design system

- Use existing Dealer OS UI: `PageShell`, `Card`, `Button`, `Input`, tokens from `@/lib/ui/tokens`, CSS variables only. No raw Tailwind color classes on feature pages. Must feel like “Set up your dealership,” not a giant admin form.

---

## 5. Entry and redirect rules

### 5.1 When to route to `/get-started`

- **First login after activation:** Already implemented — accept-invite signup redirects to `/get-started`. Keep this.
- **Authenticated user, no active dealership:** Already implemented — AuthGuard and home redirect to `/get-started` so they can select dealership or see pending invite. Keep this.
- **Authenticated user, has active dealership, onboarding incomplete:**  
  - **Option A:** Do not force redirect; allow dashboard. Show “Complete setup” in app (banner or nav) that links to `/get-started`.  
  - **Option B:** Redirect to `/get-started` until they complete or click “Finish later.”  
  Spec recommends **Option A** for V1.

### 5.2 When to let user through to dashboard

- **Onboarding complete:** Home `/` and any “Go to dashboard” from get-started send them to dashboard (existing permission-based default or dashboard).
- **Onboarding incomplete:** Still allow dashboard access; do not hard-block. Rely on soft prompt to complete setup.

### 5.3 Owner vs non-owner

- **Owner (or first user after provision):** Sees full 6-step onboarding when they land on get-started with that dealership selected (or after selecting it). We can infer “owner” by role (e.g. has `admin.dealership.write` or is the only member) or by a simple “is first user for this dealership” flag; exact rule can be “any user with permission to update dealership sees full onboarding.”
- **Other invited members:** When they first log in they may see get-started only to **select dealership** (existing CASE 1). They do not need to complete the 6 steps; those are for dealership setup, not per-user. So: if the user has multiple memberships and no active dealership → show “Select your dealership.” If they have one membership and it’s selected → redirect to dashboard (or show a minimal “You’re in” and link to dashboard). Non-owners do not get the staged 6-step flow in V1.

### 5.4 Skip and “finish later”

- **Skip:** Marks the step as skipped in onboarding state and moves to next step.
- **“Finish later” (if implemented):** From any step, user can click “I’ll finish later” → set `currentStep` so we resume next time, then redirect to dashboard. No marking onboarding complete.

---

## 6. Onboarding step details

### 6.1 Step 1 — Dealership Info

- **Fields (minimum):** Display name (required). Pre-filled from `Dealership.name` (provisioning sets this).
- **Optional:** Primary address (can map to primary `DealershipLocation`), phone, email (e.g. in `settings` or location), timezone (e.g. `settings.timezone`), logo (only if already supported elsewhere; otherwise defer).
- **API:** GET dealership (name, primary location, settings); PATCH dealership (name; optional location/settings). Use existing `PATCH /api/admin/dealership` and possibly location API.
- **Completion:** Name non-empty and saved. Optional fields can be left blank.

### 6.2 Step 2 — Team Setup

- **Actions:** Invite by email + role (using existing invite or membership flow). If dealer app has “create invite” (e.g. admin memberships or platform-admin service used from dealer), use that. Otherwise link to “Invite from Team settings” (admin/users) and treat “opened team management” or “sent at least one invite” as completion, or allow “Invite later.”
- **Skip:** “Invite later” marks step skipped and advances.
- **Completion:** At least one invite sent in this session, or skipped.

### 6.3 Step 3 — Inventory Setup

- **Choices:**  
  - **Add first vehicle** — Link to `/inventory/new`. Optionally set a flag when they land or when they create first vehicle (optional for V1).  
  - **Import inventory** — Link to bulk import entry (e.g. `/inventory/bulk/import` or the applicable route).  
  - **Skip for later** — Mark path “later” and advance.
- **Persistence:** Save `inventoryPathChosen` and mark step complete. No requirement to actually create a vehicle in V1; choosing “add first” and opening the page can count as “path chosen.”

### 6.4 Step 4 — CRM Basics

- **V1 options:**  
  - Ensure default pipeline exists (call existing pipeline service or show “CRM is ready” if default exists).  
  - Or minimal “Your CRM is set up with defaults; you can customize later” + “Continue.”  
- **Skip:** “Set up CRM later” → mark skipped, advance.
- **No deep CRM config in V1** (no full automation or sequence setup).

### 6.5 Step 5 — Operations Basics

- **V1:** Short copy about title/funding/delivery workflow (e.g. “You can manage titles, funding, and delivery from the deal desk. Configure as needed.”) + “Continue” or “Review setup later” (skip).
- **Skip:** Allowed. Mark skipped, advance.

### 6.6 Step 6 — Launch

- **UI:** “You’re all set” (or similar). Next-action cards:
  - Go to dashboard
  - Add first vehicle (link to `/inventory/new`)
  - Add first customer (link to customers create if exists)
  - Start first deal (link to deal creation if exists)
  - Invite team (link to admin/users or invite flow)
- **Completion:** Button “Go to dashboard” (or “Finish”) → set onboarding complete, redirect to dashboard.
- **Persistence:** `isComplete = true`, `completedAt = now()`.

---

## 7. Scope boundaries

### 7.1 In scope for V1

- Dealership-level onboarding state (current step, completed/skipped, completion time).
- Staged get-started UI (6 steps) with progress, save, back, skip where allowed.
- Step 1: Dealership name (and optional basics) using existing dealership/location APIs.
- Step 2: Invite team or skip; use existing invite/membership flows or link to admin.
- Step 3: Choose inventory path (add / import / later) and persist choice.
- Step 4: CRM basics — minimal acknowledgment or default pipeline check; skip allowed.
- Step 5: Operations acknowledgment or skip.
- Step 6: Launch and next-action cards; set onboarding complete; redirect to dashboard.
- Entry/redirect: first login → get-started; incomplete onboarding does not block dashboard (soft prompt only).
- Resumable flow; “continue later” behavior.

### 7.2 Out of scope / deferred

- Full advanced CRM automation setup.
- Full accounting or lender/floorplan configuration.
- Full branding/media/logo upload (unless already present).
- Advanced permissions matrix or custom roles in onboarding.
- Per-user onboarding (e.g. different steps for different roles).
- Mandatory “block dashboard until onboarding complete” (we use soft prompt).
- Dashboard redesign or new dashboard widgets for onboarding.

---

## 8. File plan

### 8.1 Backend (new)

- **Prisma:** `DealershipOnboardingState` model; migration.
- **Module:** `modules/onboarding/` (or under `core-platform` if preferred):
  - `db/onboarding.ts` — get/upsert onboarding state, update step, mark complete/skip.
  - `service/onboarding.ts` — get state, advance step, complete step, skip step, mark onboarding complete; “is onboarding required” / “should show get-started” helper.
- **API routes:**
  - `GET /api/auth/onboarding-status` — extend or keep and add optional `onboardingState` (currentStep, isComplete, completedAt) when authenticated and dealership selected; or separate `GET /api/onboarding` (dealership-scoped).
  - `GET /api/onboarding` — get current onboarding state for active dealership (auth + tenant).
  - `PATCH /api/onboarding` — save step data, advance step, mark skipped, or mark complete (auth + tenant).

### 8.2 Backend (modified)

- **Provisioning:** After creating dealership, create initial `DealershipOnboardingState` (currentStep 1, not complete). Optional: can create on first read if preferred.
- **onboarding-status:** Optionally include `onboardingComplete: boolean` and `onboardingCurrentStep` for active dealership so get-started can decide “show steps” vs “select dealership only.”

### 8.3 Frontend (new)

- **Get-started onboarding:** Replace or extend current get-started page with a stepped flow:
  - `(app)/get-started/page.tsx` — still server-fetch onboarding-status and dealerships; pass to client.
  - `(app)/get-started/OnboardingFlowClient.tsx` (or similar) — step rail, current step content, save/back/next/skip, completion screen.
  - Step components (can be in same file or under `get-started/steps/`):
    - `DealershipInfoStep.tsx`
    - `TeamSetupStep.tsx`
    - `InventorySetupStep.tsx`
    - `CrmBasicsStep.tsx`
    - `OperationsBasicsStep.tsx`
    - `LaunchStep.tsx`
- **Optional:** Banner or link in app shell (“Complete setup” when onboarding incomplete). Can be a small component in layout or dashboard.

### 8.4 Frontend (modified)

- **Get-started page:** Integrate new flow when user has active dealership (or after they select one) and onboarding is not complete. Keep existing “select dealership” and “pending invite” cases when no active dealership.
- **Home / redirect:** No change to redirect-to-get-started when no active dealership. When onboarding incomplete and option A: do not redirect from dashboard to get-started; only show soft prompt.

---

## 9. Slice plan with acceptance criteria

### SLICE A — Onboarding architecture / spec

- **Deliverable:** This spec (DEALER_ONBOARDING_COMPLETION_SPEC.md) and any refinements.
- **Acceptance:** Spec approved; steps, persistence, entry/redirect, and scope clear; no app code.

### SLICE B — Onboarding persistence / backend state

- **Deliverable:** `DealershipOnboardingState` model and migration; db layer (get, upsert, update step, mark complete/skip); service layer (get state, advance, complete, skip, isComplete); APIs (GET/PATCH onboarding); provisioning creates initial state (or lazy create on first load).
- **Acceptance:** State loads and saves per dealership; step and completion updates persist; auth and tenant enforced; no route/RBAC regressions.

### SLICE C — Get-started staged onboarding UI

- **Deliverable:** Staged get-started experience with step rail, save/back/next/skip, resumable; uses existing design system and tokens only.
- **Acceptance:** User with active dealership and incomplete onboarding sees 6-step flow; progress visible; save and resume work; no giant form; no design-system drift.

### SLICE D — Dealership / team / inventory / CRM / operations step integrations

- **Deliverable:** Step 1 (dealership info) wired to dealership/location APIs; Step 2 (team) to invite/membership or admin link; Step 3 (inventory path) persisted and linked; Steps 4–5 (CRM, operations) minimal copy and skip; Step 6 (launch) with next-action cards and completion.
- **Acceptance:** Each step saves or skips correctly; links and actions go to correct routes; completion and skip state consistent.

### SLICE E — Redirect / completion behavior

- **Deliverable:** First login and no-active-dealership behavior unchanged; when onboarding incomplete, allow dashboard access with optional “Complete setup” prompt; when user completes Step 6, set complete and redirect to dashboard.
- **Acceptance:** New owner can complete onboarding and reach dashboard; incomplete onboarding does not hard-block; non-owners are not forced through 6 steps.

### SLICE F — Tests / docs / hardening

- **Deliverable:** Targeted tests (onboarding state load/save, step advance, completion, skip); security QA; perf notes; final report; DEALER_ONBOARDING_COMPLETION_REPORT.md.
- **Acceptance:** Tests pass; docs and reports complete; known unrelated failures listed separately.

---

## 10. Risks and mitigations

| Risk | Mitigation |
|------|-------------|
| **Dumping users into incomplete dashboard** | Define “onboarding complete” clearly; soft prompt to return to get-started; Step 6 gives explicit “Go to dashboard” only after completion. |
| **Onboarding dead-ends** | Every step has a way forward (next or skip where allowed); “Finish later” optional; no required field that can’t be satisfied. |
| **Too many required fields** | Only Step 1 has a hard minimum (name); all other steps skippable or with a “later” option. |
| **Step abandonment** | Persist current step and completed/skipped; resume from same step; do not reset progress. |
| **Owner vs non-owner redirect confusion** | Apply full 6-step flow only when user has active dealership and is in a “setup” role (e.g. can update dealership); others only see “select dealership” or go to dashboard. |
| **Incomplete state corruption** | Single source of truth (DealershipOnboardingState); atomic updates; no partial writes that leave step inconsistent. |
| **Skip logic ambiguity** | Explicit “Skip” / “Later” buttons; store `skippedSteps`; completion rule per step documented. |
| **Tenant/setup leakage** | All APIs scoped by `dealershipId` from auth context; no cross-tenant reads/writes. |

---

## 11. References

- **Current get-started:** `apps/dealer/app/(app)/get-started/page.tsx`, `GetStartedClient.tsx` — 3 cases (select dealership, pending invite, no dealership).
- **Onboarding-status API:** `apps/dealer/app/api/auth/onboarding-status/route.ts` — membershipsCount, hasActiveDealership, pendingInvitesCount, nextAction.
- **Dealership update:** `apps/dealer/app/api/admin/dealership/route.ts`, `modules/core-platform/service/dealership.ts`, `DealershipPage.tsx` (name, locations).
- **Invite/membership:** `modules/platform-admin/service/invite.ts`, `modules/core-platform/service/membership.ts`; platform creates owner invite; dealer admin users/memberships.
- **Inventory:** `POST /api/inventory`, `/inventory/new`; bulk import: `app/api/inventory/bulk/import/`, etc.
- **CRM:** Customer.lead_source; Pipeline/Stage/Opportunity; default pipeline in crm-pipeline-automation.
- **Provisioning:** `modules/provisioning/service/provision.ts` — creates Dealership with name, one location “Main.”
- **Design system:** `lib/ui/tokens.ts`, `globals.css` (CSS vars), PageShell, Card, Button, Input.
- **Application approval spec:** `DEALER_APPLICATION_APPROVAL_V1_SPEC.md` — first login → get-started; no route rename.
