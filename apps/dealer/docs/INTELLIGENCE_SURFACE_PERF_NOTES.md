# Intelligence Surface Performance Notes

## Scope

Step 3 performance pass for intelligence surface expansion:

- Shared signal surface primitives under `ui-system/signals`
- Detail surface integrations (deal, vehicle, customer)
- Queue signal summaries (delivery, funding, title, CRM jobs)
- Timeline signal lifecycle mapping

No route contracts, RBAC, tenant scoping, Prisma schema, or signal-engine semantics were changed in this pass.

## What was audited

- Signal fetch strategy and request fan-out by page
- Header/context/timeline render cost and recompute behavior
- Queue summary rendering overhead
- Layout stability during async signal loading
- Adapter complexity and data-shaping costs

## Findings

- **Adapter complexity is bounded and lightweight:** sort/dedupe/filter operations run on small bounded arrays (typically `<= 40`), with no nested data fetch loops.
- **Noise-control logic reduces UI churn:** dedupe + max-visible caps (`3/5/4`) constrain render volume in high-activity tenants.
- **Timeline event projection remains cheap:** lifecycle event mapping is linear plus single sort on bounded input.
- **Queue summary overhead is low:** summary cards use existing `QueueKpiStrip` primitives and do not introduce extra row-level rendering work.
- **Recompute churn risk addressed:** header/context/timeline derived lists are now memoized on deal/inventory/customer detail pages to avoid repeated projection work during unrelated local state updates.

## Server-first and fetch behavior

- Existing integrations currently use client-side fetch-on-mount for intelligence overlays in detail/queue pages.
- This preserves current feature behavior and keeps adapters thin, but it is not fully server-first for initial signal paint.
- Given bounded limits and small payloads, current impact is acceptable for this sprint; however, server preloading remains the preferred follow-up.

## Risks reviewed

- **Layout thrash risk:** low. Signal surfaces use existing card/shell primitives; no large DOM shifts were introduced.
- **Over-fetch risk:** medium-low. Multiple pages fetch domain signals independently; limits cap payload size.
- **Render thrash risk on form-heavy pages:** reduced by memoized derived signal projections.
- **Bundle risk:** low. New primitives are presentation wrappers over existing UI-system components.

## Follow-up recommendations (next pass)

1. Move detail-page signal prefetch to server loaders where feasible, then hydrate client presenters with initial signal props.
2. Introduce short-lived request dedupe/cache for repeated domain signal fetches during same navigation session.
3. Add lightweight telemetry for signal API latency and payload size by domain to validate production behavior.
4. Consider lazy rendering of timeline signal block below fold on very dense detail pages if UX testing shows interaction delay.

## Conclusion

Performance characteristics are acceptable for current scope, with low runtime overhead and bounded render work. The pass preserves behavior and improves render stability via memoized signal derivations, while leaving clear server-first optimization opportunities for a subsequent iteration.
