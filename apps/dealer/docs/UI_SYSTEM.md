# Dealer UI design system

Use this layer so the Dealer UI stays consistent: same spacing, radii, shadows, borders, and typography everywhere. No random Tailwind palette classes.

## Use layout primitives

- **`<PageShell>`** — Wraps a page: sets `--page-bg` and page padding (`--space-page-x`, `--space-page-y`).
- **`<PageHeader>`** — Standard header: title on the left, actions on the right.
- **`<SectionGrid>`** — Grid with consistent gap from `--space-grid`.

Example:

```tsx
import { PageShell, PageHeader, SectionGrid } from "@/components/ui/page-shell";

<PageShell className="space-y-4">
  <PageHeader
    title={<h1 className="text-[24px] font-semibold leading-tight text-[var(--text)]">My Page</h1>}
    actions={<button ...>Save</button>}
  />
  <SectionGrid className="md:grid-cols-2">
    ...
  </SectionGrid>
</PageShell>
```

## Use app-level components

- **`<AppCard>` / `<AppCardContent>`** — Card with dashboard styling (radius, border, shadow stack, hover). Content padding matches MetricCard (`px-4 pb-4 pt-5`).
- **`<AppButton>`** — Button with token radius and focus ring.
- **`<AppInput>`** — Input with token radius, border, and ring.

Example:

```tsx
import { AppCard, AppCardContent } from "@/components/ui/app-card";
import { AppButton } from "@/components/ui/app-button";

<AppCard>
  <AppCardContent>
    <h3 className="text-sm font-semibold text-[var(--text)]">Title</h3>
    ...
  </AppCardContent>
</AppCard>
```

## Never use Tailwind palette colors

Use **tokens only** for colors:

- **Backgrounds:** `bg-[var(--page-bg)]`, `bg-[var(--surface)]`, `bg-[var(--surface-2)]`
- **Text:** `text-[var(--text)]`, `text-[var(--muted-text)]` (or `text-[var(--text-soft)]`)
- **Borders:** `border-[var(--border)]`
- **Focus:** `focus-visible:ring-2 focus-visible:ring-[var(--ring)]`

**Forbidden:** `bg-slate-100`, `text-gray-600`, `border-blue-200`, etc.

In development, `AppCard` / `AppButton` / `AppInput` will warn in the console if you pass forbidden palette classes.

## Token helper

`@/lib/ui/tokens` exports an `ui` object for common recipes:

```ts
import { ui } from "@/lib/ui/tokens";

// Page padding, grid gap, card surface, focus ring
ui.page   // "px-[var(--space-page-x)] py-[var(--space-page-y)]"
ui.grid   // "gap-[var(--space-grid)]"
ui.card   // card base classes
ui.soft   // "bg-[var(--surface-2)]"
ui.ring   // focus-visible ring with --ring
```

## Globals

Design tokens live in `apps/dealer/app/globals.css` (`:root`): `--page-bg`, `--surface`, `--surface-2`, `--border`, `--text`, `--muted-text`, `--ring`, `--shadow-card`, `--radius-card`, `--radius-pill`, `--space-page-x`, `--space-page-y`, `--space-grid`, etc.
