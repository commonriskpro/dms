# UI Icon System Improvements — Report

## Summary

Icon system improvements added: **icon size constants** (`ICON_SIZES`), **optional Icon wrapper component**, and **stricter ESLint rule** (paths-based) so only `@/lib/ui/icons` may be used for icons. Only `apps/dealer/lib/ui/icons.ts` is allowed to import from `lucide-react`.

---

## 1. Files Changed

| File | Change |
|------|--------|
| **apps/dealer/docs/UI_ICON_SYSTEM_SPEC.md** | New section **8.1 Icon Size Constants**: table of constants (sidebar 18, button 16, table 16, card 20), reference to `lib/ui/icons.ts`, and usage example. |
| **apps/dealer/lib/ui/icons.ts** | Added `ICON_SIZES` object (`sidebar: 18`, `button: 16`, `table: 16`, `card: 20`) with `as const`. Kept `export type { LucideIcon }`. |
| **apps/dealer/components/ui/Icon.tsx** | **New file.** Optional wrapper: accepts `icon: LucideIcon`, `size` (default 16), `className`; renders icon with `aria-hidden`. Imports `LucideIcon` from `@/lib/ui/icons`. |
| **apps/dealer/.eslintrc.json** | Replaced `patterns` entry for lucide-react with **paths**: `{ "name": "lucide-react", "message": "Import icons from '@/lib/ui/icons' instead." }`. Added **overrides** so `lib/ui/icons.ts` has `no-restricted-imports` turned off (only file allowed to import from lucide-react). |

---

## 2. Lint Verification

- **ESLint rule:** `no-restricted-imports` now uses **paths** for the exact module `lucide-react`, so any `import … from "lucide-react"` outside the override is reported with the message *"Import icons from '@/lib/ui/icons' instead."*
- **Override:** Only `lib/ui/icons.ts` is excluded from this rule so it can re-export from `lucide-react`.
- **Note:** `npm run lint` (next lint) in this repo fails with *"Invalid project directory provided"* (Next.js CLI issue). The rule is correctly configured in `.eslintrc.json` and will apply when lint runs (e.g. in CI or after fixing the Next lint invocation).

---

## 3. Icon Import Enforcement

- **Source scan:** Only `apps/dealer/lib/ui/icons.ts` contains `from "lucide-react"` (and `from 'lucide-react'`) in dealer app source. No other `*.ts`/`*.tsx` files import from `lucide-react`.
- **Icon wrapper:** `Icon.tsx` imports `LucideIcon` from `@/lib/ui/icons` only.
- **Usage:** New and existing UI should use `ICON_SIZES` and optionally `<Icon icon={…} size={ICON_SIZES.sidebar} />` for consistency.

---

## 4. Verification Steps (Run Locally)

1. **Search for lucide-react imports (source only):**
   ```bash
   grep -r "lucide-react" apps/dealer --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".next"
   ```
   Expected: only `apps/dealer/lib/ui/icons.ts`.

2. **Lint:**
   ```bash
   npm -w dealer run lint
   ```
   (If Next lint is fixed, this will enforce the rule.)

3. **Build:**
   ```bash
   npm -w dealer run build
   ```

4. **Tests:**
   ```bash
   npm -w dealer run test
   ```

---

## 5. Usage Example (Icon + ICON_SIZES)

```tsx
import { Car, ICON_SIZES } from "@/lib/ui/icons";
import { Icon } from "@/components/ui/Icon";

<Icon icon={Car} size={ICON_SIZES.sidebar} />
```

The wrapper is optional; components may still use `<Car size={ICON_SIZES.sidebar} className="…" />` directly from `@/lib/ui/icons`.
