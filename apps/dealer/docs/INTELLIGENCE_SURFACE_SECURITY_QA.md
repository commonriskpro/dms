# Intelligence Surface Security & QA

## Scope

Step 4 security/QA review for intelligence surface expansion:

- Shared signal surface primitives
- Deal/vehicle/customer header + context rail + timeline integrations
- Queue signal summaries (delivery, funding, title, CRM jobs)
- Surface adapters and timeline mapping logic

No RBAC model rewrites, route renames, backend signal-engine rewrites, or tenant model changes were introduced.

## Security checks performed

- **Tenant isolation path**
  - Signal reads are sourced from `/api/intelligence/signals`.
  - Route uses `getAuthContext()` dealership scope and delegates reads through `listSignalsForDealership(ctx.dealershipId, ...)`.
  - Result: no client-supplied dealership key; scoped by session dealership.

- **RBAC path**
  - Route-level guard uses `guardAnyPermission` with domain-based mapping.
  - Domain reads are constrained by existing permissions (`inventory.read`, `crm.read/customers.read`, `deals.read`, `inventory.acquisition.read`).
  - Result: no signal data returned without matching read permission.

- **Entity relevance enforcement**
  - Detail pages now use strict entity filtering via adapters (Deal, Vehicle, Customer).
  - Global fallback behavior for entity-scoped surfaces is disabled by default when entity scope is provided.
  - Result: detail pages do not surface unrelated entity signals.

- **Wrong-domain exposure review**
  - Queue pages request only relevant domains:
    - Delivery/Funding/Title: `operations` + `deals`
    - CRM Jobs: `crm`
  - Result: no cross-domain broad fetch for queue summaries.

- **Timeline noise and exposure**
  - Timeline maps only create/resolved lifecycle transitions from scoped signals.
  - Deduping and max-visible limits remain enforced.
  - Result: reduced risk of noisy or cross-entity timeline leakage.

## Validation outcomes

- **Deal detail pages:** show only deal-scoped intelligence entries after strict scope hardening.
- **Vehicle detail pages:** show only vehicle-scoped intelligence entries.
- **Customer detail pages:** show only customer-scoped intelligence entries.
- **Queue summaries:** remain dealership-scoped and domain-appropriate.
- **Signal action links:** remain existing route links; no new permission bypass logic introduced in UI layer.

## Hardening applied during this pass

- Updated adapter filtering to avoid automatic global fallback for entity-scoped surfaces unless explicitly enabled.
- Updated deal workspace signal projections (header/context/timeline) to use explicit `{ entityType: "Deal", entityId }`.

## Residual risks and follow-ups

1. **Client-side fetch visibility:** unauthorized attempts still trigger fetch/catch in UI (no data leak, but unnecessary request). Optional follow-up: gate fetch calls by page/domain read permissions for cleaner telemetry.
2. **Action target permissions:** action links depend on destination route guards (current behavior is acceptable). Optional follow-up: soft-hide CTA when known permission is missing to reduce dead-end navigation.
3. **Broad domain reads for contextual awareness:** current limits/caps reduce blast radius; server-side entity-filtered endpoint support would further tighten least-privilege surface reads if added in future.

## Conclusion

The integrated intelligence surfaces pass tenant and RBAC boundary checks with strict entity-scoped rendering on detail pages and domain-appropriate queue summaries. No cross-dealer leakage paths were identified in this pass, and scope hardening was applied where needed.
