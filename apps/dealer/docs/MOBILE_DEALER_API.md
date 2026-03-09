# Dealer API — Mobile consumption

The Dealer mobile app uses **only** these dealer APIs. All require authentication.

## Auth

- **Cookie (web):** Session from Supabase SSR cookies.
- **Bearer (mobile):** `Authorization: Bearer <supabase_access_token>`. When Bearer is present and no active-dealership cookie, backend uses the user’s first active membership as dealership context.

## Endpoints used by mobile

| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/me | Current user, active dealership, permissions (mobile-friendly shape). |
| GET | /api/auth/session | Full session (web); same auth as /api/me. |
| GET | /api/inventory | List vehicles. Query: limit, offset, status, search, sortBy, sortOrder, etc. |
| GET | /api/inventory/[id] | Vehicle detail + photos. |
| GET | /api/customers | List customers. Query: limit, offset, status, search, sortBy, sortOrder. |
| GET | /api/customers/[id] | Customer detail. |
| GET | /api/deals | List deals. Query: limit, offset, status, customerId, vehicleId, sortBy, sortOrder. |
| GET | /api/deals/[id] | Deal detail. |

## Response shapes

- **GET /api/me:** `{ user: { id, email }, dealership: { id, name? }, permissions?: string[] }`
- **List endpoints:** `{ data: T[], meta: { total, limit, offset } }`
- **Detail endpoints:** `{ data: T }`
- **Errors:** `{ error: { code, message, details? } }` with HTTP 4xx/5xx.

## Permissions

RBAC is enforced server-side. Common keys: `inventory.read`, `inventory.write`, `customers.read`, `customers.write`, `deals.read`, `deals.write`. Mobile should only call endpoints the user is allowed to use; 403 indicates insufficient permission.

## Base URL

Mobile must call the dealer app origin (e.g. `https://dealer.example.com` or dev URL). Configure in app env (e.g. `EXPO_PUBLIC_DEALER_API_URL`).
