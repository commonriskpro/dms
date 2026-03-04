# Step 4 — Onboarding Performance & Rate Limit Notes

Brief notes on caching and rate limits for the onboarding flow.

---

## Onboarding-status internal call cache

- **Where:** `apps/platform/lib/onboarding-status-cache.ts`
- **Key:** `ownerInviteStatus:${dealerDealershipId}:${contactEmailHash}`
- **TTL:** 15 seconds
- **Stored:** status, expiresAt, acceptedAt, invitedAt (optional). **No email, no token.**
- **Behavior:** GET onboarding-status for an application with mapping and contact email first calls dealer internal `GET /api/internal/dealerships/[id]/owner-invite-status?email=...`; result is cached. Subsequent requests within 15s use cache and do not call dealer. Best-effort; serverless may not persist across invocations.

---

## Rate limit thresholds (documented)

### Dealer (existing — `lib/api/rate-limit.ts`)

| Route / type | Limit | Window |
|--------------|--------|--------|
| invite_resolve | 60 req/min | 1 min |
| invite_accept | 10 req/min | 1 min |
| invite_accept (per token, hashed key) | 5 req | 15 min |
| session_switch | 30 req/min | 1 min |

### Platform (Step 4 — `lib/rate-limit.ts`)

| Route / type | Limit | Window |
|--------------|--------|--------|
| onboarding_status | 120 req/min | 1 min |
| provision | 20 req/min | 1 min |
| invite_owner | 20 req/min | 1 min |

### Dealer internal (existing — `lib/internal-rate-limit.ts`)

- Applied to: provision/dealership, owner-invite, owner-invite-status, monitoring routes.
- Configurable; production uses rate limit store (e.g. DB-backed events).

---

## Error responses

- **429:** `{ error: { code: "RATE_LIMITED", message: "Too many requests" } }` (or per-token message for invite accept).
- No internal details or token in any response.
