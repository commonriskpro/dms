# Dealer Application Approval V1 — Performance Notes

**Sprint:** Dealer Application + Approval Flow V1  
**Step:** 5 — Performance Pass  
**Scope:** New application/approval/activation surfaces only. No redesign; routes unchanged unless a real performance issue required a tiny safe fix.

---

## Surfaces audited

- `/apply` — entry (start / resume)
- `/apply/[id]` — stepped application form
- `/apply/invite/[token]` — invite token → application redirect
- `/apply/success` — post-submit static page
- Platform: dealer applications list (`/platform/dealer-applications`)
- Platform: dealer application detail (`/platform/dealer-applications/[id]`)
- Accept-invite → `/get-started` handoff

---

## 1. Staged form rerender cost

**Location:** `apps/dealer/app/apply/[id]/ApplyFormClient.tsx`

- **Behavior:** One step is rendered at a time via `step === 0`, `step === 1`, … `step === 5`. Only the active step component is mounted; the others are not in the tree.
- **State:** A single `profile` state object is updated with `updateSection(key, updater)`, which does `setProfile((p) => ({ ...p, [key]: updater(p[key]) }))`. Each keystroke in a step updates that step’s slice and causes one parent re-render and one re-render of the current step (the only step mounted).
- **Verdict:** Rerender cost is reasonable. No full-form re-render (all six steps are not mounted). No memoization added; steps are small and React’s default behavior is sufficient for this form size.

---

## 2. Draft save / update behavior

**Location:** Same `ApplyFormClient`; PATCH `/api/apply/[id]`.

- **When save runs:** `saveDraft()` is invoked only on (1) “Save & next” (`handleNext`) and (2) immediately before “Submit application” (`handleSubmit`). It is not called on every keystroke or on a timer.
- **Payload:** One PATCH per transition with the current `profile` (businessInfo, ownerInfo, etc.). Server: `updateDraft` → `upsertDealerApplicationProfile` (single Prisma read + upsert).
- **Verdict:** Draft save is lightweight: one request per step transition or submit, minimal server work.

---

## 3. Step navigation and client churn

- **Navigation:** “Back” only updates `step` (no network). “Save & next” awaits `saveDraft()` then increments `step`. No double-save or extra requests.
- **DOM:** Step change unmounts one step and mounts the next. No mounting of all steps; no hidden “all steps in DOM” pattern.
- **Verdict:** No excessive client churn on step navigation.

---

## 4. Layout and large form sections

- **Layout:** Single column, `max-w-xl`, fixed step progress bar. No conditional layout shifts from dynamic content; step content is swapped in one Card.
- **Step 4 (Additional locations):** Dynamic list of location cards; each card is a fixed structure. `list.map` with `key={i}`. For typical “additional locations” counts this is fine; no virtual list. If future use expects many items (e.g. tens), consider virtualization later.
- **Verdict:** No layout thrash observed; large sections are bounded and structure is stable.

---

## 5. Platform review queue and detail

**List:** `apps/platform/app/(platform)/platform/dealer-applications/page.tsx`

- Single fetch on mount and when `offset`, `status`, or `userId` change. No polling. Payload: list of 25 items with minimal fields (id, source, status, ownerEmail, submittedAt, approvedAt, rejectedAt, dealershipId, platformApplicationId, platformDealershipId, createdAt). No profile or notes in list.
- **Verdict:** Queue remains lightweight.

**Detail:** `apps/platform/app/(platform)/platform/dealer-applications/[id]/page.tsx`

- One GET on load (`refetch` in `useEffect` when `id`/`userId` available). After approve / reject / save notes, one `refetch()` (one GET). No polling, no duplicate fetches on same action.
- **Verdict:** Detail remains lightweight.

---

## 6. Invite token resolution

**Client:** `/apply/invite/[token]` — one `GET /api/apply/invite/${token}` then `router.replace(\`/apply/${data.applicationId}\`)`. Single request, then redirect; no retry or duplicate call.

**Server:** `GET /api/apply/invite/[token]` — rate limit check; `getInviteByToken(token)` (Prisma `findUnique` on token); status/expiry checks; `getApplicationByInviteId(invite.id)` (Prisma `findFirst` where inviteId, orderBy createdAt desc); if none, `createDraft(...)` (one transaction: create application + profile). Single response with application + profile.

- **Verdict:** Invite token resolution is efficient (one round-trip, minimal DB work).

---

## 7. Activation handoff (accept-invite → get-started)

**Flow:** Accept-invite signup: `POST /api/invite/accept` (creates user, membership, marks application activated) → client `signInWithPassword` → `window.location.href = "/get-started"`. Full page navigation to get-started.

**Get-started load:** Page is RSC. Server runs `Promise.all([fetchOnboardingStatus(cookieHeader), fetchDealerships(cookieHeader)])` and passes `initialOnboardingStatus` and `initialDealerships` to `GetStartedClient`. Client uses these props; it does not refetch onboarding-status or dealerships on mount.

- **Verdict:** Activation handoff does not create unnecessary extra fetches. One redirect; get-started loads once with two server-side fetches in parallel; no duplicate client-side onboarding/dealership requests.

---

## 8. Other surfaces

- **`/apply` (entry):** One POST to create draft on “Start application”; resume is client-only navigation. No extra calls.
- **`/apply/success`:** Static content; no data fetch.
- **`/apply/[id]` page:** Server renders with Suspense; client `ApplyFormClient` does one GET to load application when `applicationId` is set. Single load per visit.

---

## 9. Summary

| Surface / concern              | Result   | Notes                                                |
|-------------------------------|----------|------------------------------------------------------|
| Staged form rerender          | OK       | One step mounted; parent + current step only         |
| Draft save / update           | OK       | One PATCH per step or submit; no keystroke save      |
| Step navigation churn         | OK       | Single save then step change; no double requests     |
| Layout / large sections       | OK       | Stable layout; Step4 list fine for typical size      |
| Platform list                 | OK       | Single fetch, limit 25, minimal fields                |
| Platform detail               | OK       | One GET on load, one refetch per action              |
| Invite token resolution       | OK       | One GET, minimal DB (invite + app or create)          |
| Accept-invite → get-started    | OK       | One redirect; get-started uses server data only      |

No performance issues required route or design changes. No code changes applied.
