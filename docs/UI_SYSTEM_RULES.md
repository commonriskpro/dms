# Dealer App — UI System Rules

**Target:** apps/dealer. **Source of truth:** docs/DASHBOARD_V3_SPEC.md + dashboard mock (2025 enterprise SaaS).

---

## 1. Only shadcn-style primitives

- Use **only** components from `@/components/ui` for UI primitives: Button, Card, Input, Label, Select, Table, Tabs, Dialog, Popover, Skeleton.
- Do **not** use raw `<button>`, `<input type="text">`, or custom card/button abstractions that duplicate these. Use `<Button>`, `<Input>`, `<Card>`, etc.
- If a primitive is missing (e.g. Badge, DropdownMenu, Separator, Tooltip, Sheet), add it in **shadcn style** under `apps/dealer/components/ui/` (Tailwind + CSS variables, no new UI library).

---

## 2. Only semantic tokens

- **Colors, radius, shadow, spacing:** Use `@/lib/ui/tokens` (e.g. `dashboardCard`, `severityBadgeClasses`, `widgetRowSurface`, `dashboardGrid`, `dashboardPageBg`).
- **Do not** use raw Tailwind color classes in dashboard or shared UI: no `bg-blue-500`, `text-amber-800`, `border-red-200`, etc.
- Use CSS variable–based classes: `bg-[var(--panel)]`, `text-[var(--text-soft)]`, `border-[var(--border)]`, and token exports that reference `var(--success-muted)`, `var(--warning)`, etc.
- **Single theme:** One palette in `app/globals.css` (:root). No alternate palettes or ad-hoc hex/hsl in components.

---

## 3. Forbidden class patterns

- **Forbidden:** `bg-{blue|emerald|green|red|amber|violet|slate|gray}-*`, `text-{...}-*`, `border-{...}-*` (arbitrary Tailwind color scales).
- **Allowed:** `bg-[var(--...)]`, `text-[var(--...)]`, token imports from `@/lib/ui/tokens`, and layout/utility classes (flex, grid, gap, padding, width).
- **Enforcement:** Jest test `components/dashboard-v3/__tests__/dashboard-ui-tokens.test.ts` fails if dashboard-v3 components contain forbidden patterns.

---

## 4. How to add new UI components correctly

1. **New primitive (e.g. Badge):** Add `apps/dealer/components/ui/badge.tsx` using Tailwind and CSS variables (e.g. `--accent`, `--success-muted`, `--warning-muted`). Export from the file; do not add a new npm UI library.
2. **New token:** Add the class string or semantic name to `apps/dealer/lib/ui/tokens.ts` and use it in components.
3. **New dashboard widget:** Use `WidgetCard` + token-based row styling (`widgetRowSurface`, `severityBadgeClasses`). Do not introduce new card or row styles that bypass tokens.
4. **Layout/spacing:** Use `spacingTokens`, `dashboardGrid`, `dashboardPageBg` from tokens. Tailwind layout (flex, grid, gap, padding) is allowed for structure only.

---

## 5. Correct imports (examples)

```ts
// ✅ Primitives
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

// ✅ Tokens
import { dashboardCard, severityBadgeClasses, widgetRowSurface, dashboardGrid } from "@/lib/ui/tokens";

// ❌ Forbidden
import { Button } from "@mui/material";
import { Card } from "antd";
```

---

## 6. Cursor / AI instructions

- When editing or adding UI in apps/dealer: use only `@/components/ui` primitives and `@/lib/ui/tokens`. Do not suggest MUI, Chakra, Mantine, Bootstrap, or raw Tailwind color classes (e.g. bg-blue-500). Match the mock: rounded-xl cards, subtle borders, semantic status colors, one theme.
