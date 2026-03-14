# Home Landing Behavior

When an authenticated user with an active dealership visits `/` (or completes get-started/onboarding), they are redirected to a workspace. The decision order is deterministic and permission-safe.

## Decision order

1. **Last workspace**  
   If the user has a stored "last workspace" for the current dealership and still has permission to access it, redirect there. Stored per dealership in `localStorage` (`dms:last-workspace:v1:<dealershipId>`). Updated when the user navigates inside the app shell (see `LastWorkspaceTracker`).

2. **Role-aware default**  
   If there is no valid last workspace, use this order:
   - **Admin-only** (no sales/inventory): first admin route they can access (dealership → users → roles → audit → dealership).
   - **Sales**: `/sales` (any of `crm.read`, `deals.read`, `customers.read`).
   - **Inventory**: `/inventory` (`inventory.read`).
   - **Manager**: `/dashboard` (`dashboard.read` or `reports.read`).
   - **Documents**: `/files` (`documents.read`).

3. **Fallback**  
   `/dashboard`.

## Implementation

- **Landing logic**: `apps/dealer/app/page.tsx` (client).
- **Last-workspace model**: `apps/dealer/lib/last-workspace.ts` (keys, paths, permissions, get/set, path→key mapping).
- **Persistence**: `LastWorkspaceTracker` in `components/app-shell/LastWorkspaceTracker.tsx`; runs inside AppShell and writes on pathname change when the path maps to a workspace.

## Workspace keys

Valid stored keys: `sales`, `inventory`, `manager`, `admin`, `customers`, `crm`, `deals`, `operations`, `websites`, `reports`. Only these are written and only these are used for redirect; invalid or stale values are ignored.
