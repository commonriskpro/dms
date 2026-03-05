# UI Icon System Spec

Single source of truth for icon usage across the Dealer app. All icons come from **lucide-react** and MUST be imported from `@/lib/ui/icons` only.

---

## 1. Sidebar Navigation Icons

| Route / concept | Lucide icon | Notes |
|-----------------|-------------|--------|
| Dashboard       | `LayoutDashboard` | Main app home |
| Inventory       | `Car`             | Vehicles; same concept always uses Car |
| Customers       | `Users`           | Customer list / people |
| Deals           | `Handshake`       | Deals / agreements |
| Marketing       | `Megaphone`       | CRM / marketing |
| Reports         | `BarChart3`       | Reports / analytics |
| Admin           | `Settings`        | Admin / settings |

Additional sidebar items (if present):

| Label          | Lucide icon | Notes |
|----------------|-------------|--------|
| Favorites      | `Star`      | Saved / favorites |
| Pending Print  | `BarChart3` or `Printer` | Map to Reports or print concept per product |

---

## 2. System Utility Icons

| Concept | Lucide icon |
|---------|-------------|
| Search  | `Search` |
| Filters | `SlidersHorizontal` |
| Alerts / Notifications | `Bell` |
| Refresh | `RefreshCw` |
| Export  | `Download` |
| Import  | `Upload` |
| Print   | `Printer` |

---

## 3. Table Action Icons

| Action | Lucide icon |
|--------|-------------|
| View   | `Eye` |
| Edit   | `Pencil` |
| Delete | `Trash` |
| More   | `MoreHorizontal` |

---

## 4. Inventory Module Icons

| Concept        | Lucide icon   |
|----------------|---------------|
| Add Vehicle    | `PlusCircle`  |
| Vehicle Photos | `Image`       |
| VIN Decode     | `ScanLine`    |
| Floor Plan     | `Building2`   |

---

## 5. CRM / Customer Icons

| Concept         | Lucide icon    |
|-----------------|----------------|
| Add Customer    | `UserPlus`     |
| Customer Profile| `User`         |
| Notes           | `StickyNote`   |
| Tasks           | `CheckSquare`  |
| Messages        | `MessageSquare`|

---

## 6. Deal Desk Icons

| Concept        | Lucide icon  |
|----------------|--------------|
| Start Deal     | `FilePlus`   |
| Contract       | `FileText`   |
| Payment        | `CreditCard` |
| Funding        | `Banknote`   |
| Completed Deal| `BadgeCheck` |

---

## 7. Status Icons

| Status  | Lucide icon    |
|---------|----------------|
| Success | `CheckCircle`  |
| Warning | `AlertTriangle`|
| Error   | `CircleAlert`  |
| Info    | `Info`         |

---

## 8. Icon Size Rules

| Context        | Size  | Tailwind / implementation      |
|----------------|-------|---------------------------------|
| Sidebar icons  | 18px  | `h-[18px] w-[18px]` or `size={18}` |
| Buttons        | 16px  | `h-4 w-4` or `size={16}`        |
| Table actions  | 16px  | `h-4 w-4` or `size={16}`        |
| Card indicators| 20px  | `h-5 w-5` or `size={20}`        |

---

## 8.1. Icon Size Constants

Icons must use shared constants defined in:

```
apps/dealer/lib/ui/icons.ts
```

| Constant   | Value | Usage            |
|------------|-------|------------------|
| `sidebar`  | 18    | Sidebar nav icons |
| `button`  | 16    | Button icons     |
| `table`   | 16    | Table action icons |
| `card`    | 20    | Card indicators  |

Example:

```ts
import { Car, ICON_SIZES } from "@/lib/ui/icons";
// Use ICON_SIZES.sidebar (18), ICON_SIZES.button (16), etc.
```

---

## 9. Icon Usage Rules

1. **Source:** Icons MUST come ONLY from `lucide-react`, re-exported via `@/lib/ui/icons`. No direct `lucide-react` imports in app or module code.
2. **Navigation:** Always use icon + label in navigation (no icon-only without accessible label).
3. **Decorative:** No purely decorative icons; every icon must support meaning or action.
4. **Consistency:** Same concept always uses the same icon (e.g. vehicles → `Car`, customers → `Users`/`User` as per context).
5. **Sizing:** Use the size rules above; prefer a single `className` or `size` prop for consistency.

---

## 10. Reference: Central Export

All icons are exported from:

```
apps/dealer/lib/ui/icons.ts
```

Import pattern:

```ts
import { Car, Users, Eye } from "@/lib/ui/icons"
```

Do not import from `lucide-react` anywhere else in the dealer app.
