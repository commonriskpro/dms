# Platform Cutover Report

This report records the completed removal of the dealer-hosted platform control plane.

Cutover result:
- [`apps/platform`](../../apps/platform) is now the sole platform control plane.
- Dealer-hosted platform pages are removed.
- Dealer-hosted public `/api/platform/*` control-plane routes are removed.
- Dealer retains only dealer-owned invite/support/internal bridge paths that `apps/platform` still needs.

## 1. Dealer-Hosted Platform Surfaces Found

Removed dealer pages:
- `apps/dealer/app/platform/layout.tsx`
- `apps/dealer/app/platform/dealerships/page.tsx`
- `apps/dealer/app/platform/dealerships/[id]/page.tsx`
- `apps/dealer/app/platform/invites/page.tsx`
- `apps/dealer/app/platform/users/page.tsx`

Removed dealer public platform routes:
- `apps/dealer/app/api/platform/dealerships/route.ts`
- `apps/dealer/app/api/platform/dealerships/[id]/route.ts`
- `apps/dealer/app/api/platform/dealerships/[id]/disable/route.ts`
- `apps/dealer/app/api/platform/dealerships/[id]/enable/route.ts`
- `apps/dealer/app/api/platform/dealerships/[id]/roles/route.ts`
- `apps/dealer/app/api/platform/dealerships/[id]/members/route.ts`
- `apps/dealer/app/api/platform/dealerships/[id]/members/[membershipId]/route.ts`
- `apps/dealer/app/api/platform/dealerships/[id]/invites/route.ts`
- `apps/dealer/app/api/platform/dealerships/[id]/invites/[inviteId]/route.ts`
- `apps/dealer/app/api/platform/pending-users/route.ts`
- `apps/dealer/app/api/platform/pending-users/[userId]/approve/route.ts`
- `apps/dealer/app/api/platform/pending-users/[userId]/reject/route.ts`
- `apps/dealer/app/api/platform/impersonate/route.ts`

Removed dealer-only test coverage:
- `apps/dealer/app/platform/__tests__/create-invite-validation.test.tsx`
- `apps/dealer/app/platform/__tests__/layout.test.tsx`
- `apps/dealer/app/platform/__tests__/xss-safety.test.tsx`
- `apps/dealer/modules/core-platform/tests/platform-admin.test.ts`
- `apps/dealer/modules/core-platform/tests/platform-admin-create-account.test.ts`

Removed dealer-only implementation glue:
- `apps/dealer/modules/platform-admin/service/pending-users.ts`

## 2. What Was Migrated Into `apps/platform`

No new feature migration was required in this sprint because the standalone platform app already owned the real control-plane workflows:
- dealership registry and detail pages
- platform users
- owner invite orchestration
- dealership invite list/revoke via dealer internal bridge
- status changes, provision, monitoring, audit, billing/reporting shells
- support-session start via `/api/platform/impersonation/start`

The cutover was primarily deletion and reference cleanup rather than feature-porting.

## 3. What Was Deleted Instead of Migrated

Deleted as obsolete dealer-hosted control-plane behavior:
- dealer-side pending-user review APIs
- dealer-side dealership member management APIs under public `/api/platform/*`
- dealer-side dealership role listing under public `/api/platform/*`
- dealer-side platform impersonation entrypoint
- dealer-hosted operator UI for dealerships, users, and invites

Reason:
- these were legacy control-plane paths inside `apps/dealer`
- the owner explicitly chose full cutover/removal rather than compatibility retention
- the canonical platform control plane already exists in `apps/platform`

## 4. Files Added or Changed

Dealer app:
- updated `apps/dealer/components/ui-system/navigation/AppSidebar.tsx`
- updated `apps/dealer/modules/platform-admin/service/index.ts`
- updated `apps/dealer/ui-tokens.allowlist.txt`
- updated `apps/dealer/app/api/invite/resolve/route.ts`
- updated `apps/dealer/app/api/invite/accept/route.ts`
- added `apps/dealer/app/api/invite/schemas.ts`
- added `apps/dealer/app/api/invite/schemas.test.ts`
- updated `apps/dealer/lib/tenant.ts`

Canonical docs:
- updated architecture, API, module, feature, status, checklist, known-gaps, legacy, and index docs
- added this report

## 5. Files Removed

See §1 for the full dealer page/API/test deletion list.

Net result:
- `apps/dealer/app/platform` removed
- `apps/dealer/app/api/platform` removed

## 6. Remaining Platform-Related Follow-Up

Residual dealer-side compatibility still present:
- dealer invite service and dealer internal invite/status endpoints
- dealer support-session consume/end endpoints

These are not alternate control planes.
They remain because platform workflows still depend on dealer-owned invite/support/internal bridge behavior.

## 7. Sole Control Plane Confirmation

Confirmed end state:
- `apps/platform` is now the only platform control plane in this repository.
- No dealer-hosted `/platform/*` page surface remains.
- No dealer-hosted public `/api/platform/*` control-plane route remains.
- Dealer-side platform coupling is limited to internal bridge/support/invite behavior, not a second operator surface.
