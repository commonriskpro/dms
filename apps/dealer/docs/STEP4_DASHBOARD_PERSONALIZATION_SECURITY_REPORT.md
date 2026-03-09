# Step 4 — Dashboard Personalization Security Report

## Security / correctness checklist

| Item | Status | Notes |
|------|--------|--------|
| Strict tenant isolation for all reads/writes | Done | `getSavedLayout`, `saveLayout`, `resetLayout` all take `dealershipId` and `userId` from server session only. API routes use `getAuthContext(request)`; no client-supplied dealership/user in body. |
| User cannot save layout for another user | Done | `ctx.dealershipId` and `ctx.userId` from `getAuthContext`; save and reset use these only. |
| RBAC-gated widgets cannot be injected via payload | Done | Save route calls `filterPayloadToAllowed(payload, ctx.permissions)`; only widgets allowed by permissions are persisted. Merge service strips forbidden widgets. |
| Unknown/legacy widget ids ignored safely | Done | Merge service: `getWidgetById(p.widgetId)` returns undefined for unknown; such entries skipped. Persistence filters to allowed ids only. |
| Removed widgets from future code degrade gracefully | Done | Registry is code-based; removed id no longer in registry; merge strips it from saved payload; no crash. |
| Malformed saved JSON cannot break dashboard render | Done | `parseLayoutJson` returns null for invalid; merge treats null as no saved layout. Client receives server-computed layout only. |
| Fixed widgets cannot be illegally hidden/moved | Done | Registry marks fixed; merge restores fixed widgets to default; save body is filtered to allowed widgets and valid zones (no separate fixed override from client). |
| No sensitive info in errors/logs | Done | Audit logs action/entity only; no layout payload in logs. API errors return generic messages. |
| Rate limiting | Not added | Dashboard layout save/reset are low-frequency; no rate limit in handler. Can be added later if needed per app standards. |
| Users without saved layout get default | Done | `getSavedLayout` returns null; merge uses default from registry filtered by RBAC. |

## RBAC

- Dashboard access: `customers.read` or `crm.read` (existing).
- Save/Reset: `guardAnyPermission(ctx, ["customers.read", "crm.read"])` — same as dashboard access.
- Widget visibility: Each widget has `requiredPermissions`; merge and save filter by `session.permissions`.

## Tenant isolation

- All DB queries: `DashboardLayoutPreference` by `dealershipId` + `userId`; unique on `(dealershipId, userId)`.
- No cross-tenant read/write possible; session resolves dealership and user from auth cookie/Bearer token.
