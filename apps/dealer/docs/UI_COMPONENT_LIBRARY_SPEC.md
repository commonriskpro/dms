# UI_COMPONENT_LIBRARY_SPEC

Version: v1
Status: Authoritative
Owner: Platform UI Architecture
Last Updated: 2026-03

---

# Overview

This document defines the **shared UI component library** for the Dealer App.

It translates the approved UI architecture and visual system into concrete reusable components so all present and future pages follow the same structural and visual language.

This spec governs:

- shell components
- navigation components
- widget components
- table and queue primitives
- entity headers
- board and timeline components
- empty, loading, and error states
- theme-aware usage rules
- component ownership boundaries

This document must be used together with:

- `UI_SYSTEM_ARCHITECTURE_V1.md`
- `UI_VISUAL_SYSTEM_V1.md`
- `UI_NAVIGATION_ARCHITECTURE.md`
- `UI_PAGE_LAYOUT_STANDARD.md`
- `UI_PATTERNS.md`
- `UI_COMPONENT_INVENTORY.md`

---

# 1. Library Goals

The shared component library exists to ensure:

- pixel-consistent UI across modules
- stable light/dark theme behavior
- faster implementation of new pages
- predictable page composition
- minimal design drift
- clean separation between shared presentation and module-specific business logic

Core rule:

**Shared components receive typed props and render UI. They do not own module business logic or duplicate API fetch behavior.**

---

# 2. Ownership Rules

## Shared component location

All shared UI system components must live under:

`apps/dealer/components/ui-system/`

Recommended subfolders:

- `layout/`
- `navigation/`
- `widgets/`
- `tables/`
- `queues/`
- `entities/`
- `feedback/`
- `boards/`
- `timeline/`
- `forms/`

## Module-specific component location

Feature presenters remain inside:

- `apps/dealer/modules/*/ui`
- or existing module UI folders

Examples:

- inventory-specific cards
- acquisition-specific panels
- lender-specific action forms
- title workflow action panels

Rule:

Promote a component to the shared library only when it is clearly reusable across two or more domains.

---

# 3. Foundational Layout Components

## 3.1 `PageShell`

Purpose:
Provides the canonical page frame for authenticated pages.

Responsibilities:
- page spacing
- content max width
- responsive vertical rhythm
- optional right rail composition
- theme-safe surface behavior

Visual contract:
- uses system page background
- 32px content padding desktop
- 24px internal grid gap
- supports 12-column page layouts where needed

Props:
- `children`
- `rail?: ReactNode`
- `fullWidth?: boolean`
- `className?: string`

Rules:
- default server-compatible wrapper
- required on all authenticated pages
- may contain client children
- must not fetch page-specific business data

---

## 3.2 `PageHeader`

Purpose:
Provides a consistent page heading and action area.

Responsibilities:
- title
- description
- breadcrumb slot for deep routes
- status/meta slot
- primary and secondary actions

Props:
- `title: string`
- `description?: string`
- `breadcrumbs?: ReactNode`
- `meta?: ReactNode`
- `actions?: ReactNode`

Visual contract:
- title: page-title token
- description: secondary text token
- spacing between title and description fixed by token
- action zone aligned right on desktop, stacked on mobile

Use on:
- dashboard
- inventory
- customers
- deals
- queue pages
- reports
- admin pages
- entity detail pages

---

## 3.3 `FilterBar`

Purpose:
Standard top-of-list filter/search row.

Responsibilities:
- search input
- faceted filters
- view toggles
- saved views
- sort controls
- utility actions

Props:
- `search?: ReactNode`
- `filters?: ReactNode`
- `actions?: ReactNode`
- `viewControls?: ReactNode`

Behavior:
- URL query params should remain source of truth
- server-first compatible
- interactive controls may be client components

Use on:
- inventory list
- customers list
- deals list
- queue pages
- reports
- board pages

---

## 3.4 `ContextRail`

Purpose:
Standardized right-side secondary context surface.

Responsibilities:
- alerts
- related actions
- mini metrics
- activity snapshots
- queue summaries
- related entities

Props:
- `children`
- `sticky?: boolean`
- `collapsible?: boolean`

Rules:
- optional on any page
- should not hold primary workflow content
- preferred for secondary awareness and blockers

---

# 4. Navigation Components

## 4.1 `AppSidebar`

Purpose:
Primary authenticated navigation shell.

Responsibilities:
- brand block
- primary nav groups
- active route state
- permission-aware visibility
- footer utility actions

Visual contract:
- fixed width 260px
- tokenized background
- tokenized border
- icon size 20px
- item height 40px
- active item uses accent background and active text token

Props:
- `items: SidebarGroup[]`
- `footer?: ReactNode`
- `userSlot?: ReactNode`

Rules:
- must render only approved route-safe items
- must align with `UI_NAVIGATION_ARCHITECTURE.md`
- no page should roll its own sidebar

---

## 4.2 `SidebarGroupLabel`

Purpose:
Subtle label separating nav groups.

Visual contract:
- uppercase or micro-label style per tokens
- secondary text color
- fixed spacing above and below

---

## 4.3 `SidebarItem`

Purpose:
Single navigation link.

States:
- default
- hover
- active
- disabled
- badge
- collapsed tooltip variant

Props:
- `href`
- `icon`
- `label`
- `active?: boolean`
- `badge?: ReactNode`

---

## 4.4 `TopCommandBar`

Purpose:
Global command/action row at the top of application pages.

Responsibilities:
- global search entry
- quick create actions
- notifications
- theme toggle
- user menu

Rules:
- shared across dashboard and major workflow pages
- consistent spacing and height in light and dark themes

---

# 5. Card and Widget Components

## 5.1 `Widget`

Purpose:
Base container for dashboard and contextual widgets.

Anatomy:
- header
- optional subtitle
- optional action slot
- content
- optional footer

Props:
- `title`
- `subtitle?`
- `action?`
- `children`
- `footer?`
- `state?: "default" | "loading" | "empty" | "error"`

Visual contract:
- radius: card token
- padding: widget token
- border and background tokenized
- consistent header spacing
- supports light and dark theme with no custom overrides

Rules:
- all dashboard widgets must use `Widget`
- modules may compose specialized widgets from it

---

## 5.2 `MetricCard`

Purpose:
Displays KPI metrics.

Content contract:
- label
- value
- delta
- trend direction
- optional sparkline
- optional severity

Props:
- `label: string`
- `value: ReactNode`
- `delta?: ReactNode`
- `trend?: "up" | "down" | "flat"`
- `sparkline?: ReactNode`
- `severity?: "default" | "success" | "warning" | "error"`

Use on:
- dashboard
- queue summaries
- reports
- finance panels

Rules:
- numbers should use tabular numerals
- label/value spacing must be fixed
- no ad hoc KPI card variants allowed

---

## 5.3 `AlertCard`

Purpose:
Displays action-required items and warnings.

Content contract:
- severity
- title
- body
- optional action button
- optional metadata

Use on:
- dashboard
- context rails
- detail page blockers
- queue summaries

---

## 5.4 `InsightCard`

Purpose:
Displays summarized intelligence blocks like price-to-market, aging, title backlog, recon metrics.

Rules:
- derived from `Widget`
- uses approved semantic chips only
- charts or mini-bars must use consistent internal padding

---

# 6. Table Components

## 6.1 `TableLayout`

Purpose:
Canonical shell for list/table pages.

Responsibilities:
- toolbar slot
- table container
- loading, empty, error states
- footer pagination zone

Props:
- `toolbar?: ReactNode`
- `children`
- `pagination?: ReactNode`
- `state?: "default" | "loading" | "empty" | "error"`

Visual contract:
- header height: 40px
- row height: 48px baseline
- cell padding: tokenized
- subtle hover background
- tokenized separators

Rules:
- required for all major data tables
- no bespoke table wrappers allowed

---

## 6.2 `TableToolbar`

Purpose:
Standard toolbar above tables.

Slots:
- search
- filters
- sort
- column visibility
- bulk actions
- export / utility actions

---

## 6.3 `ColumnHeader`

Purpose:
Standard column heading with optional sort affordance.

Rules:
- sorting icon alignment fixed
- uses small/secondary text token
- supports compact and standard variants

---

## 6.4 `RowActions`

Purpose:
Standard row action trigger and menu.

Rules:
- placement consistent at far right
- overflow menu style standardized
- icon/button size tokenized

---

## 6.5 `StatusBadge`

Purpose:
Semantic state chip used across tables, cards, queues, and detail pages.

Allowed variants:
- `success`
- `warning`
- `error`
- `info`
- `neutral`

Optional domain labels:
- Ready
- Aging
- Recon
- Overpriced
- Underpriced
- Funding Pending
- Title Blocked

Rules:
- all labels must map to semantic variants
- no custom status colors outside tokens
- shape, height, and padding fixed by tokens

---

# 7. Queue Components

## 7.1 `QueueLayout`

Purpose:
Shared shell for operational queue pages.

Anatomy:
- queue header
- KPI strip
- filter row
- queue table
- optional preview panel

Props:
- `header`
- `kpis`
- `filters`
- `table`
- `preview?: ReactNode`

Use on:
- delivery queue
- funding queue
- title queue
- CRM jobs

Rules:
- queue pages must use `QueueLayout`
- SLA/status semantics must be visualized consistently
- preview panel should reuse `Widget`

---

## 7.2 `QueueKpiStrip`

Purpose:
Compact summary strip for counts by status.

Rules:
- same height and spacing on every queue page
- cards should use metric token variants, not bespoke styling

---

## 7.3 `QueueTable`

Purpose:
Specialized table presentation for operational workflow lists.

Features:
- urgency
- SLA badge
- status chip
- row actions
- optional side preview sync

Rules:
- built on top of `TableLayout`
- no custom queue tables per module

---

# 8. Board Components

## 8.1 `KanbanBoard`

Purpose:
Stage-based pipeline board.

Use on:
- CRM board
- future stage-based internal workflows

Capabilities:
- stage columns
- card count summaries
- quick actions
- drag/drop support
- mobile fallback list mode

Rules:
- stages use consistent header style
- cards use shared board-card contract
- no one-off board styling by page

---

## 8.2 `BoardColumn`

Purpose:
Single stage column with header and card stack.

---

## 8.3 `BoardCard`

Purpose:
Entity card for pipeline items.

Content contract:
- avatar or entity icon
- primary label
- secondary entity context
- monetary/value field
- optional timestamp / next task

Visual contract:
- fixed radius
- tokenized padding
- border/background from theme tokens
- consistent card hover state

---

# 9. Entity Components

## 9.1 `EntityHeader`

Purpose:
Canonical header for detail/workspace pages.

Supports:
- title
- identifier
- status chips
- key meta
- primary actions
- breadcrumbs

Variants:
- customer
- vehicle
- deal
- opportunity

Rules:
- all detail pages begin with an `EntityHeader`
- module-specific body sections render beneath it

---

## 9.2 `CustomerHeader`

Purpose:
Customer-focused header variant.

Fields:
- full name
- contact methods
- assigned rep
- lead status
- quick communication actions

---

## 9.3 `VehicleHeader`

Purpose:
Vehicle-focused header variant.

Fields:
- year / make / model
- stock
- VIN shortcut
- pricing status
- recon/floorplan/photo state

---

## 9.4 `DealWorkspace`

Purpose:
Shared deal workspace shell.

Sections:
- summary
- customer
- vehicle
- trade
- products
- delivery
- funding
- title

Rules:
- section order must remain consistent
- action bars and blockers belong in standard slots
- timeline/history belongs in secondary rail or approved section

---

# 10. Timeline and Activity Components

## 10.1 `ActivityTimeline`

Purpose:
Chronological activity feed.

Use on:
- customer detail
- deal detail
- vehicle detail
- dashboard/activity widgets

Content model:
- timestamp
- actor
- event type
- summary
- metadata chips
- optional deep link

Rules:
- event item anatomy must be shared
- timeline spacing fixed by tokens
- event iconography maps to approved event set

---

## 10.2 `TimelineItem`

Purpose:
Single timeline row.

Variants:
- note
- call
- sms
- email
- status change
- task
- automation event
- audit event

---

# 11. Feedback Components

## 11.1 `EmptyStatePanel`

Purpose:
Reusable empty state block.

Supports:
- icon/illustration slot
- title
- body
- primary action
- secondary action

Use on:
- empty widgets
- empty tables
- empty timelines
- empty queues
- empty lists

---

## 11.2 `ErrorStatePanel`

Purpose:
Reusable error state block.

Supports:
- title
- description
- retry action
- optional support text

---

## 11.3 `LoadingSkeletonSet`

Purpose:
Reusable skeleton patterns for page, widget, table, queue, and detail layouts.

Rules:
- skeleton shapes should resemble final layout
- light and dark themes must both be supported

---

# 12. Form Components

## 12.1 `FormSectionCard`

Purpose:
Structured section card for complex forms and workspaces.

Use on:
- vehicle create/edit
- deal desk sections
- settings forms
- admin forms

Rules:
- consistent section header
- inline validation area
- footer actions optional

---

## 12.2 `FormErrorSummary`

Purpose:
Top-level summary for validation problems in multi-section forms.

---

## 12.3 `InlineFieldHelp`

Purpose:
Consistent field hint/help text.

---

# 13. Theme and Visual Compliance

All components must support:

- light mode
- dark mode
- token-only visual styling

Rules:
- no raw page-level color classes
- no hardcoded hex values inside feature components
- components consume theme variables/tokens only
- focus rings must be accessible in both themes

---

# 14. Accessibility Requirements

Every shared component must support:

- keyboard navigation
- visible focus state
- accessible labels for icon-only buttons
- semantic HTML where possible
- sufficient contrast in light and dark themes

Tables and boards must provide non-mouse alternatives where interaction is required.

---

# 15. Testing and Stability Rules

The component library must be protected through:

- visual regression coverage for shell and widget primitives
- snapshot or structural tests for stable shared components
- theme rendering checks for light and dark mode
- permission/visibility smoke coverage for navigation components

No major shared component should be introduced without:
- token compliance
- accessibility review
- light/dark mode verification

---

# 16. Initial Required Component Build Order

Phase 1 shared components:
- `PageShell`
- `PageHeader`
- `FilterBar`
- `ContextRail`
- `AppSidebar`
- `TopCommandBar`
- `Widget`
- `MetricCard`
- `TableLayout`
- `StatusBadge`
- `EmptyStatePanel`
- `ErrorStatePanel`
- `LoadingSkeletonSet`

Phase 2 shared components:
- `QueueLayout`
- `QueueTable`
- `QueueKpiStrip`
- `KanbanBoard`
- `BoardColumn`
- `BoardCard`
- `EntityHeader`
- `ActivityTimeline`
- `FormSectionCard`

---

# 17. Implementation Summary

This component library spec ensures:

- every new page starts from approved primitives
- dashboard widgets look and behave consistently
- tables and queues share one family of patterns
- detail pages use a canonical workspace frame
- light and dark themes remain visually aligned
- future pages continue speaking the same UI language

This document is the operational bridge between the UI architecture and actual implementation.
