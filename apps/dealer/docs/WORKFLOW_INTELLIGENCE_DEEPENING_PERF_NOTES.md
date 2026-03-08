# Workflow Intelligence Deepening — Performance Notes

**Sprint:** Workflow Intelligence Surface Deepening  
**Spec:** `WORKFLOW_INTELLIGENCE_DEEPENING_SPEC.md`  
**Scope:** Audit of touched workflow intelligence integrations only. No redesign; no backend/route/RBAC/tenant changes.

---

## 1. Audit Summary

| Surface | Finding | Status |
|--------|---------|--------|
| DealWorkspace blockers strip | Single client fetch on mount (by deal id); derived state via useMemo; strip conditional. | OK |
| Deal / vehicle / customer timeline explanations | Derived in render from event.signal; max 8 items; toSignalExplanation is pure and cheap. | OK |
| Queue row blocker column | groupSignalsByEntityId behind useMemo([allQueueSignals, data]); Map lookup per row. | OK |
| Inbox customer alerts block | One fetch per selectedCustomerId change; useMemo for scoped list. | OK |
| Shared primitives & adapters | Pure functions / presentational components; no fetch inside; small fixed lookups. | OK |
| Adapter-side filtering/grouping | All useMemo with correct deps; no work in hot render path beyond memoized results. | OK |

---

## 2. DealWorkspace Blockers Strip

- **Data flow:** One `fetchSignalsByDomains(["deals", "operations"], { includeResolved: true, limit: 40 })` in a `useEffect` with dependency `[id]`. Fires once per deal load; no refetch on unrelated state (e.g. form edits).
- **Derived state:** `headerSignals`, `contextSignals`, `blockerSignals`, `timelineSignalEvents` are all computed in `useMemo` with appropriate dependencies (`surfaceSignals`, `entityScope`, `headerSignals` for context dedupe). `blockerSignals` is a filter + slice of `contextSignals` (max 5, then Blockers block shows max 3).
- **Render:** Blockers strip is conditional: `blockerSignals.length > 0` only. No layout thrash; strip appears/vanishes without affecting surrounding layout structure.
- **Server-first:** Deal data remains server-driven (initialData / desk state); signal fetch is a single client overlay for intelligence only.

**Verdict:** No change. Behavior and cost are acceptable.

---

## 3. Deal / Vehicle / Customer Timeline Explanations

- **Computation:** For each timeline event with `event.signal`, the UI calls `toSignalExplanation(event.signal)` in render and passes the result to `SignalExplanationItem`. Timeline is capped at 8 events (`maxVisible: 8`).
- **Cost of toSignalExplanation:** Pure function: property reads, optional code lookups from two small static objects (~9 entries each), no I/O. Cost per call is negligible.
- **SignalExplanationItem:** Presentational only; no state, no effects, no context. Renders a small block of text and an optional link.
- **Re-renders:** When parent (e.g. DealDeskWorkspace) re-renders, the timeline re-renders and `toSignalExplanation` runs again for each event. Same inputs produce same outputs; no cascading updates. No memoization added so as to avoid extra complexity for a small, bounded list.

**Verdict:** Lightweight. No hardening added.

---

## 4. Queue Row Blocker Column

- **Data flow:** One `fetchSignalsByDomains(..., { limit: 50 })` in a `useEffect` with empty dependency list. Fires once per queue page load. Result stored in `allQueueSignals`.
- **Grouping:** `signalsByDealId = useMemo(() => groupSignalsByEntityId(allQueueSignals, data.map((r) => r.id)), [allQueueSignals, data])`. Recomputation runs only when `allQueueSignals` or `data` (reference) changes. Client-side filter (search/status) does not change `data`, so no recomputation on keystroke or filter change.
- **Per-row cost:** Each row does `signalsByDealId.get(row.id)` (O(1)) and, when non-empty, renders `SignalBlockerInline` with a small array. No allocation or heavy work in the row render path.
- **groupSignalsByEntityId:** Single pass over signals, Map insertions, then in-place sort of each list. Runs only when the useMemo deps change (e.g. after fetch or pagination).

**Verdict:** Grouping is not repeatedly recomputed in hot render paths. No change.

---

## 5. Inbox Customer Alerts Block

- **Data flow:** `useEffect` with dependency `[selectedCustomerId]`. When `selectedCustomerId` is set, fetches `fetchSignalsByDomains(["crm"], { limit: 30 })`; when cleared, sets `inboxSignals` to `[]`. Mount guard used to avoid setState after unmount.
- **Noise:** One request per selection change. Rapidly switching conversations (e.g. keyboard nav) can trigger multiple requests; each request is a single, small CRM domain call (limit 30). No debounce added so that the selected conversation’s alerts appear immediately; if rapid switching becomes a concern, a short debounce (e.g. 150–200 ms) could be added later.
- **Derived state:** `customerContextSignals = useMemo(() => toContextSignals(inboxSignals, { maxVisible: 5, entity: { entityType: "Customer", entityId: selectedCustomerId ?? undefined } }), [inboxSignals, selectedCustomerId])`. Recomputes only when signals or selection change. Block is rendered only when `customerContextSignals.length > 0`.

**Verdict:** Lightweight and not noisy under normal use. No change; optional debounce documented as a future option if needed.

---

## 6. Shared Explanation and Signal Primitives

- **toSignalExplanation (explanation-adapters):** Pure; no I/O; small object and string operations and lookups in fixed maps. Safe to call from render.
- **SignalExplanationItem:** Presentational; token-only styling; no hooks that would trigger extra work or re-renders.
- **SignalBlockerInline:** Receives a small array and renders a severity badge and count. No side effects.
- **groupSignalsByEntityId, toContextSignals, toHeaderSignals, etc.:** Pure adapter functions. Used only inside useMemo or in one-off effects (fetch then setState). Not invoked on every render in a hot path without memoization.

**Verdict:** No performance risk from these primitives.

---

## 7. Adapter-Side Filtering and Grouping

- **Deal / vehicle / customer pages:** Entity scope and signal lists are memoized; filtering (toHeaderSignals, toContextSignals, toTimelineSignalEvents) runs only when its inputs change.
- **Queue pages:** Same pattern: `queueSignals` and `signalsByDealId` are memoized from `allQueueSignals` and `data`. Filtering/sorting is inside the memo, not in the table body.
- **Inbox:** Scoping is inside useMemo for `customerContextSignals`; no filtering in a tight loop.

**Verdict:** Adapter-side work is correctly gated by useMemo; no repeated heavy work in hot render paths.

---

## 8. Layout and Rerendering

- **Blockers strip (deal):** Conditional block; when present it has fixed structure. No dynamic height that would cause layout shift beyond one extra block.
- **Timeline items:** Each item is a fixed-structure card; explanation content is short text. No images or large dynamic content that would cause thrash.
- **Queue Alerts column:** Fixed column with small inline content (badge + “N issues”). No resize or layout reflow from signal content.
- **Inbox alerts block:** Renders only when there are signals; stable structure. No full-width or hero-style elements.

No redesign or layout changes were introduced; new surfaces are additive and compact.

---

## 9. Optional Future Hardening (Not Implemented)

- **Inbox:** If analytics show rapid conversation switching, consider debouncing the signal fetch (e.g. 150–200 ms) or skipping refetch when the selected customer is the same as the last fetched (e.g. ref to `lastFetchedCustomerId`).
- **Timeline:** If timelines ever grow beyond a few dozen items or become virtualized, consider memoizing `toSignalExplanation(event.signal)` per event (e.g. in a small wrapper component with `React.memo` and a stable explanation prop) to avoid redundant work on parent re-renders. Not required for current max of 8.

---

## 10. Conclusion

- **Server-first:** Preserved; intelligence is a client overlay on top of existing server-driven deal/vehicle/customer and queue data.
- **Inbox:** Single, lightweight fetch per selection; acceptable; optional debounce/skip noted for later if needed.
- **Queue row grouping:** Memoized; not recomputed on search/filter; per-row cost is a Map lookup and a small presentational component.
- **Timeline explanations:** Bounded (max 8 items), pure derivation and simple UI; no extra hardening added.
- **Layout and rerenders:** No layout thrash or excessive rerendering observed; new surfaces are conditional and compact.

No code changes were made in this pass. Only safe, minimal hardening is suggested as optional follow-ups above.
