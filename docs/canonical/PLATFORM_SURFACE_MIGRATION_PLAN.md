# Platform Surface Migration Plan

This plan applies the now-fixed decision that [`apps/platform`](../../apps/platform) is the canonical platform control plane.

Scope:
- platform/admin/operator surfaces that still live inside [`apps/dealer`](../../apps/dealer)
- their migration posture
- the safest phased path to converge on `apps/platform`

This is a planning document. It does not perform the migration.

## 1. Canonical Direction

Canonical destination:
- [`apps/platform`](../../apps/platform)

Non-canonical but still present:
- dealer-hosted platform pages under [`apps/dealer/app/platform`](../../apps/dealer/app/platform)
- dealer-hosted platform APIs under [`apps/dealer/app/api/platform`](../../apps/dealer/app/api/platform)
- dealer-side platform-admin auth helper in [`apps/dealer/lib/platform-admin.ts`](../../apps/dealer/lib/platform-admin.ts)

Future rule:
- New platform/operator functionality should land in `apps/platform`.
- Dealer-side platform surfaces should only remain where they are still needed for migration, compatibility, or tightly coupled dealer-DB operations.

## 2. Current Dealer-Side Platform Surface Inventory

### Dealer-hosted pages

Present under [`apps/dealer/app/platform`](../../apps/dealer/app/platform):
- `layout.tsx`
- `dealerships/page.tsx`
- `dealerships/[id]/page.tsx`
- `invites/page.tsx`
- `users/page.tsx`

Classification:
- `legacy/transitional UI`

Recommended posture:
- do not expand
- migrate user-facing operator workflows to `apps/platform`
- keep temporarily only while cutover/usage verification is incomplete

### Dealer-hosted APIs

Present under [`apps/dealer/app/api/platform`](../../apps/dealer/app/api/platform):
- `dealerships/*`
- `pending-users/*`
- `impersonate`

Classification:
- `compatibility-only` for now

Recommended posture:
- keep temporarily where they still operate on dealer DB state that has not yet been bridged or re-homed
- avoid building new operator workflows on these endpoints

### Dealer-side auth coupling

Present in [`apps/dealer/lib/platform-admin.ts`](../../apps/dealer/lib/platform-admin.ts):
- `PlatformAdmin` table lookup
- `requirePlatformAdmin(userId)`

Classification:
- `migration dependency`

Why it matters:
- Dealer-hosted platform routes currently depend on dealer-side platform-admin membership.
- The platform app uses a separate auth model in [`apps/platform/lib/platform-auth.ts`](../../apps/platform/lib/platform-auth.ts).

## 3. Existing Canonical Platform Surface

Already implemented in [`apps/platform`](../../apps/platform):
- platform auth and role gating
- applications review and provisioning flows
- dealerships registry
- users/accounts
- monitoring and maintenance
- audit
- reports
- billing/subscription management shell

Core route roots:
- UI under [`apps/platform/app/(platform)/platform`](../../apps/platform/app/%28platform%29/platform)
- APIs under [`apps/platform/app/api/platform`](../../apps/platform/app/api/platform)

This is the target growth surface.

## 4. Classification of Dealer-Side Platform Areas

| Dealer-side surface | Current status | Recommended disposition | Notes |
|---|---|---|---|
| [`apps/dealer/app/platform/layout.tsx`](../../apps/dealer/app/platform/layout.tsx) and page shell | transitional | remove later | Dealer-hosted operator shell should not be the long-term platform UI. |
| [`apps/dealer/app/platform/dealerships/*`](../../apps/dealer/app/platform/dealerships) | migrate to `apps/platform` | keep temporarily | Duplicates dealership/operator concerns already modeled in the platform app. |
| [`apps/dealer/app/platform/invites/page.tsx`](../../apps/dealer/app/platform/invites/page.tsx) | migrate to `apps/platform` | keep temporarily | Operator invite workflows belong in the platform control plane. |
| [`apps/dealer/app/platform/users/page.tsx`](../../apps/dealer/app/platform/users/page.tsx) | migrate to `apps/platform` | keep temporarily | Platform user management is already a platform-app concern. |
| [`apps/dealer/app/api/platform/impersonate/route.ts`](../../apps/dealer/app/api/platform/impersonate/route.ts) | compatibility-only | keep temporarily | Risky coupling to dealer support flows; verify usage and target replacement carefully. |
| [`apps/dealer/app/api/platform/dealerships/*`](../../apps/dealer/app/api/platform/dealerships) | compatibility-only | migrate or bridge | Review endpoint-by-endpoint against existing platform APIs before removal. |
| [`apps/dealer/app/api/platform/pending-users/*`](../../apps/dealer/app/api/platform/pending-users) | compatibility-only | migrate or bridge | Likely replaceable by platform-side review APIs, but verify dealer-DB dependencies first. |
| [`apps/dealer/lib/platform-admin.ts`](../../apps/dealer/lib/platform-admin.ts) | migration dependency | keep temporarily | Needed until dealer-side privileged operations are fully bridged or removed. |

## 5. Risky Couplings To Watch

1. Dealer DB authority
- Some dealer-hosted platform endpoints operate directly on dealer DB entities and may not yet have platform-app bridge replacements.

2. Support impersonation
- [`apps/dealer/app/api/platform/impersonate/route.ts`](../../apps/dealer/app/api/platform/impersonate/route.ts) is likely operationally sensitive and should not be moved blindly.

3. Dual admin identity models
- Dealer-side `PlatformAdmin` and platform-side `PlatformUser` are not the same persistence model.
- Migration needs a clear policy for when dealer-side platform-admin rows can stop being the active gate.

4. Signed internal bridge assumptions
- Some platform operations already flow through signed dealer internal endpoints.
- Moving UI/API surfaces without checking those bridges can create duplicate orchestration paths.

## 6. Migration Phases

## Phase 0 - Freeze Growth On Dealer Platform Surfaces

Targets:
- treat dealer `/platform/*` pages and `/api/platform/*` routes as legacy/transitional only
- route all new platform feature work to [`apps/platform`](../../apps/platform)

Risk:
- Low

Success criteria:
- no new platform operator features are added under `apps/dealer/app/platform` or `apps/dealer/app/api/platform`

## Phase 1 - Inventory Route-By-Route Replacements

Targets:
- map each dealer-hosted page/API to:
  - existing platform-app equivalent
  - required bridge work
  - compatibility-only holdover

Risk:
- Low

Dependencies:
- endpoint-by-endpoint comparison against [`apps/platform/app/api/platform`](../../apps/platform/app/api/platform)

Success criteria:
- every dealer-side platform route has a disposition and target owner

## Phase 2 - Migrate User-Facing Operator Flows

Targets:
- move dealership, invite, and user management UI workflows to `apps/platform`
- leave dealer-side APIs only where direct compatibility is still needed

Risk:
- Medium

Dependencies:
- parity review for platform UI workflows
- operator signoff on moved surfaces

Success criteria:
- operators can perform primary platform tasks from `apps/platform` without relying on dealer-hosted pages

## Phase 3 - Bridge Or Retire Dealer-Side APIs

Targets:
- replace dealer-side platform APIs with:
  - platform APIs backed by existing dealer internal bridges, or
  - explicit compatibility shims with deprecation notices

Risk:
- High

Dependencies:
- confirmation of dealer-DB writes still required
- impersonation/support workflow decision

Success criteria:
- dealer `/api/platform/*` is reduced to explicitly justified compatibility endpoints only

## Phase 4 - Retire Dealer Platform Shell

Targets:
- remove dealer platform pages and layout once usage is cut over

Risk:
- High

Dependencies:
- confirmed zero/near-zero operational dependency
- fallback/rollback path for support staff

Success criteria:
- `apps/dealer/app/platform` is removed or reduced to an intentional compatibility redirect shell

## 7. Needs Human Confirmation

These still require explicit confirmation before migration/removal:
1. Is dealer-side impersonation intended to remain a dealer-only support path, or should it be initiated exclusively from `apps/platform`?
2. Which dealer `/api/platform/*` endpoints still serve real operator workflows that are not yet available in `apps/platform`?
3. Should dealer-side `PlatformAdmin` rows remain a long-term support overlay, or should platform-side identity become the only operator gate?

## 8. Recommended Next Steps

1. Freeze new platform work in dealer code.
2. Produce an endpoint/page parity matrix between dealer platform routes and platform app routes.
3. Migrate the highest-traffic operator pages to `apps/platform` first.
4. Treat impersonation and dealer-side privileged writes as the final migration tranche, not the first.
