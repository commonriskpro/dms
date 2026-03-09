# Step 4 — Dashboard Personalization Hardening Security Report

## Security checklist

| Item | Status |
|------|--------|
| Cache keys user/dealership scoped | Pass — Key is `dashboard_layout:${dealershipId}:${userId}`. |
| No cross-tenant cache leakage | Pass — Key includes both IDs; no shared bucket. |
| Cache does not bypass RBAC | Pass — Cached value is post-merge (permissions already applied). Cache populated only after merge with session permissions. |
| Oversized payloads fail safely | Pass — 400 VALIDATION_ERROR before any DB write; 10KB and 50-widget limits enforced. |
| Malformed/legacy layouts do not break render | Pass — parseLayoutJson returns null for invalid; merge treats null as no saved layout. Legacy rows without widgetVersion parse via relaxed schema. |
| Version mismatches do not crash | Pass — Merge uses current registry definition; unknown/removed widgets stripped. |
| Rate limiting works and returns safe response | Pass — 429 with `{ error: { code: "RATE_LIMITED", message: "Too many requests" } }`; no payload in response. |
| No sensitive payload in logs/errors | Pass — Audit logs action/entity only. No layout JSON in logs. API errors return generic or validation message. |

## Notes

- Checksum is a hash of normalized layout (no PII). Stored in DB for no-op optimization only.
- Cache stores only serializable layout (widget ids, zone, order, visible, title, etc.); no permissions or user secrets.
