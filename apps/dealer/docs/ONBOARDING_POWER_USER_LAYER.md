# Onboarding and Power User Layer

Usability layer for **new users** (clarity, guided next steps) and **power users** (speed, shortcuts, saved views). No tutorial flood; onboarding is silent and integrated.

---

## Part A — New user clarity

### Goals

- **Empty states**: Clear copy and a single “what to do next” action where it makes sense (e.g. Add vehicle, Add lead).
- **Guided prompts**: One-line explanatory copy; optional “Tip” only where dismissible and non-noisy.
- **First-run paths**: By workspace, safe first action (e.g. Inventory → Add vehicle; Customers → Add lead; CRM pipeline → Add lead).

### Patterns

- Use shared `EmptyState` with `title`, `description`, and optional `actionLabel` + `actionHref` (or `onAction`).
- When list is empty because **no data exists** (total === 0) and user can create: show primary action (Add vehicle, Add lead).
- When list is empty because **filters exclude everything**: show “No X match the current filters” and no create action (or “Clear filters”).
- Do not add long tutorials or multi-step checklists unless a workspace explicitly needs a short checklist (e.g. “Set up website: Theme → Pages → Publish”).

### Out of scope (this layer)

- No popovers or tooltips on every control.
- No mandatory “tour” or multi-step wizard.

---

## Part B — Power user speed

### Goals

- **Command palette (⌘K)**: Permission-aware; Create items only shown when user has the right permission.
- **Quick Create**: Visible in TopCommandBar; same permission rules. Keyboard hint (⌘K) in search placeholder so power users discover it.
- **Saved views**: Where the app already persists view preference (e.g. inventory table/cards, CRM board/list), avoid hiding that it’s saved; optional short “Saved” or “View saved” hint in section copy, not a big banner.
- **Persistent filters**: Reuse existing URL-based filters; no new persistence in this layer unless trivial (e.g. last filter in sessionStorage for one page).

### Patterns

- Command palette: Filter **Create** items by `customers.write`, `inventory.write`, `deals.write`. Navigate items can stay visible or be permission-filtered in a follow-up.
- Global search placeholder: Include “⌘K for commands” so the shortcut is discoverable.
- Quick Create dropdown: No change to behavior; already permission-gated. Optional: tooltip “Quick Create (⌘K)” on the trigger.

### Out of scope (this layer)

- Full saved-view UI (save/name/load presets) beyond existing preference persistence.
- New keyboard shortcuts beyond ⌘K for command palette.
