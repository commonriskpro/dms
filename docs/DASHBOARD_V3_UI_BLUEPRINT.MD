0) Purpose

This is a pixel recipe for the Dealer Dashboard UI.
Rule: Implementation must match this blueprint. If something is missing, update this file first. Do not invent styles.

1) Global layout constants (locked)

These values are not negotiable.

1.1 Canvas

Page background: --page-bg

Main content max width: not constrained (full width), but content uses padding + grid.

1.2 Sidebar (left rail)

Sidebar width: 272px

Sidebar outer radius: 24px

Sidebar padding: 16px

Sidebar internal gap (between sections): 12px

Sidebar background: vertical gradient using --sidebar-top → --sidebar-bottom

Sidebar border: none (soft shadow only)

Sidebar shadow: --shadow-sidebar

Sidebar sections

Brand row (top)

Primary nav list (Dashboard/Inventory/Customers/Deals/Marketing/Admin)

Divider

Secondary nav (Favorites/Pending Print)

Divider

Footer dealership switch row

1.3 Topbar

Height: 64px

Background: transparent (sits on page bg)

Horizontal padding: 24px

Vertical alignment: center

Search width: 560px (centered-ish; can shrink responsive)

Right icon cluster gap: 12px

Avatar size: 36px

1.4 Page padding + grid

Page horizontal padding: 24px

Page vertical padding (top): 18px

Grid columns: 12

Grid gap: 16px

Card radius: 16px

Card padding: 16px

Card header padding: 16px 16px 10px 16px

Card body padding: 0 16px 16px 16px (rows add their own)

Card border: 1px solid var(--border)

Card background: --surface

Card shadow: --shadow-card

2) Color + typography tokens (locked)
2.1 CSS variables (globals.css)

Define these in apps/dealer/app/globals.css under :root:

:root{
  /* Page + surfaces */
  --page-bg: #f3f5fb;
  --surface: #ffffff;
  --surface-2: #f6f8ff;
  --border: rgba(15, 23, 42, 0.08);

  /* Text */
  --text: #0f172a;
  --muted: rgba(15, 23, 42, 0.55);

  /* Shadows */
  --shadow-card: 0 10px 30px rgba(15, 23, 42, 0.06);
  --shadow-sidebar: 0 16px 40px rgba(15, 23, 42, 0.12);

  /* Sidebar */
  --sidebar-top: #1f2a44;
  --sidebar-bottom: #162033;
  --sidebar-text: rgba(255,255,255,0.78);
  --sidebar-text-strong: rgba(255,255,255,0.92);
  --sidebar-pill: rgba(255,255,255,0.10);
  --sidebar-pill-active: rgba(96,165,250,0.20);

  /* Metric accents (bars) */
  --accent-inventory: #33b7a7;  /* teal */
  --accent-leads: #4ade80;      /* green */
  --accent-deals: #a78bfa;      /* purple */
  --accent-bhph: #fb923c;       /* orange */

  /* Severity chips (widget left badges) */
  --sev-info: #2dd4bf;     /* teal-ish */
  --sev-success: #34d399;  /* green */
  --sev-warning: #fb923c;  /* orange */
  --sev-danger: #f87171;   /* red */

  /* Controls */
  --ring: rgba(59,130,246,0.25);
  --radius-card: 16px;
  --radius-pill: 14px;
  --radius-input: 12px;
}

If you already have semantic tokens, map them to these names (don’t duplicate palettes).

2.2 Typography rules

Page title “Dashboard”: 24px, font-semibold

Metric number: 36px, font-bold

Metric label: 14px, font-medium

Widget title: 16px, font-semibold

Widget row label: 14px, font-medium

Muted helper text: 12–13px, uses --muted

3) Component blueprints (exact)

All components must be built using shadcn/ui primitives (Card, Button, Input, etc.) and your semantic token helpers, but the DOM structure and sizing below must be respected.

3.1 AppShell (layout)
Structure
<AppShell>
  <Sidebar />
  <Main>
    <Topbar />
    <PageBody>{children}</PageBody>
  </Main>
</AppShell>
AppShell container classes

Root: min-h-screen bg-[var(--page-bg)]

Shell grid: grid grid-cols-[272px_1fr] gap-6 p-6

Sidebar wrapper: rounded-[24px] overflow-hidden shadow-[var(--shadow-sidebar)]

Main wrapper: min-w-0

3.2 Sidebar (exact)
Container

w-[272px] rounded-[24px] bg-gradient-to-b from-[var(--sidebar-top)] to-[var(--sidebar-bottom)] text-[var(--sidebar-text)]

Brand row

Height: 56px

Layout: icon + “DMS AUTO” + hamburger

Classes:

row: flex items-center justify-between px-4 py-3

left: flex items-center gap-2

title: text-[var(--sidebar-text-strong)] font-semibold tracking-wide

Nav item (default)

Height: 44px

Classes:

item: flex items-center gap-3 px-3 py-2 rounded-[14px] hover:bg-[var(--sidebar-pill)] transition

icon: opacity-90

label: text-[13px] font-medium

Nav item (active)

Classes:

bg-[var(--sidebar-pill-active)] text-[var(--sidebar-text-strong)]

left indicator: optional small glow is allowed but not required

Divider

my-3 h-px bg-white/10 mx-4

Footer dealership switch

Row height: 56px

Rounded pill inside: rounded-[16px] bg-white/10 px-3 py-2 flex items-center justify-between

3.3 Topbar (exact)
Container

h-16 flex items-center justify-between px-6

Search

Container: w-[560px]

Input wrapper: relative

Input:

height: 44px

rounded-[12px] bg-white/60 border border-[var(--border)] shadow-sm pl-10 pr-10

focus ring: focus-visible:ring-2 focus-visible:ring-[var(--ring)]

Left icon: search at left-3 top-1/2 -translate-y-1/2

Right icon: small search/command icon at right

Right cluster

flex items-center gap-3

Icon buttons are ghost buttons, 36x36, rounded-full

Avatar: h-9 w-9 rounded-full bg-slate-200

4) Dashboard page layout (grid exact)
4.1 Page header row

Left: “Dashboard” title

Right: “Last updated X min ago” + Refresh button

Container: flex items-center justify-between mb-4

Refresh button: rounded-[12px]

4.2 Grid placement (12-col)

Row 1: four metric cards

Inventory: col-span-3

Leads: col-span-3

Deals: col-span-3

BHPH: col-span-3

Row 2:

Customer Tasks: col-span-5

Inventory Alerts: col-span-4

Recommended Actions: col-span-3

Row 3:

Floorplan & Lending: col-span-5

Deal Pipeline: col-span-4

Upcoming Appointments: col-span-3

Row 4:

Finance Notices: col-span-9

Quick Actions: col-span-3

Grid wrapper:

grid grid-cols-12 gap-4

5) MetricCard (exact)
Dimensions

min height: 108px

padding: 16px

radius: 16px

Structure
<Card>
  <CardContent>
    <div class="flex items-start justify-between">
      <div>
        <div class="text-sm font-medium">Title</div>
        <div class="text-4xl font-bold leading-tight">182</div>
      </div>
      <div class="h-9 w-9 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center">
        Icon
      </div>
    </div>

    <div class="mt-3 flex items-center justify-between text-xs text-[var(--muted)]">
      <span>+12 listed</span>
      <span class="flex items-center gap-1">…</span>
    </div>

    <div class="mt-3 h-2 rounded-full bg-black/5 overflow-hidden">
      <div class="h-full w-[55%] bg-[var(--accent-*)] rounded-full"></div>
    </div>
  </CardContent>
</Card>
Accent mapping

Inventory bar uses --accent-inventory

Leads bar uses --accent-leads

Deals bar uses --accent-deals

BHPH bar uses --accent-bhph

6) WidgetCard (exact)
WidgetCard container

Same base Card styling.

Header: title left, menu “…” right.

Header row:

flex items-center justify-between mb-3

Title: text-base font-semibold

Menu button: ghost icon 32x32

WidgetRow (exact)

Row height: 44px

Row surface: bg-[var(--surface-2)]

Row border: border border-[var(--border)]

Row radius: 12px

Spacing: px-3 py-2

Layout:

left: badge + label

right: count + optional “Total →”

Structure:

<div class="flex items-center justify-between rounded-[12px] bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 min-h-[44px]">
  <div class="flex items-center gap-3">
    <div class="h-7 w-7 rounded-[10px] text-white text-xs font-bold flex items-center justify-center bg-[var(--sev-*)]">
      9
    </div>
    <div class="text-sm font-medium">Appointments</div>
  </div>
  <div class="flex items-center gap-2 text-xs text-[var(--muted)]">
    <span>9</span>
    <span>•</span>
    <span>0 Total</span>
  </div>
</div>

Severity mapping for badge color:

Customer Tasks uses --sev-info (teal) for all rows

Inventory Alerts uses per-row severity:

Cars in recon: --sev-warning

Pending tasks: --sev-warning

Missing docs: --sev-danger

Low stock: --sev-warning

Deal Pipeline uses --accent-deals / purple-ish badge for most rows

7) Recommended Actions (exact)

This card is a stack of mini-panels.

Structure:

<Card>
  <Header title="Recommended Actions" menu />
  <div class="space-y-3">
    <div class="rounded-[14px] bg-[var(--surface-2)] border border-[var(--border)] p-3">
      <div class="flex gap-3">
        <IconWarning />
        <div>
          <div class="text-sm font-semibold">2 deals need funding approval</div>
          <Button size="sm" class="mt-2 rounded-[12px]">Review deals</Button>
        </div>
      </div>
    </div>
    ...
  </div>
</Card>

Buttons are “soft”:

background: --surface

border: --border

rounded: 12px

8) Upcoming Appointments (exact)

Rows include avatar + name + meta.

Row structure:

flex items-center justify-between

Left: avatar + name + subtitle

Right: time label + secondary label

9) Finance Notices (exact)

Rows are simple list items with icon + text + date on right.

Keep to max 5 rows

Each row uses the WidgetRow surface style (12px radius)

10) Quick Actions (exact)
Layout

Two buttons side-by-side (Add Vehicle, Add Lead)

One full-width button below (Start Deal)

Buttons are large, pill-ish (12px radius) with icon.

Structure:

<Card>
  <Header title="Quick Actions" menu />
  <div class="grid grid-cols-2 gap-3">
    <Button class="h-11 rounded-[12px] bg-[var(--accent-deals)] text-white">Add Vehicle</Button>
    <Button class="h-11 rounded-[12px] bg-[var(--accent-leads)] text-white">Add Lead</Button>
    <Button class="h-11 rounded-[12px] col-span-2 bg-[var(--accent-inventory)] text-white">Start Deal</Button>
  </div>
</Card>

(If you want exact colors to match the mock, keep mapping consistent and do not use Tailwind palettes.)

11) Determinism rules (hard)
11.1 Token-only rule

No Tailwind palette classes anywhere in dashboard shell:

forbidden: bg-blue-* text-slate-* border-gray-* etc

allowed: bg-[var(--...)] border-[var(--...)] text-[var(--...)]

11.2 Snapshot tests

Add Jest snapshots for:

Sidebar

Topbar

MetricCard

WidgetCard + WidgetRow

DashboardV3Client

Snapshot must use fixed dashboardGeneratedAt.

11.3 Visual policy test

Add a test that scans apps/dealer/components/dashboard-v3/** and components/layout/** and fails if forbidden palette classes appear.

12) Implementation scope

Only dealer app UI:

apps/dealer/components/layout/Sidebar.tsx

apps/dealer/components/layout/Topbar.tsx

apps/dealer/components/dashboard-v3/*

apps/dealer/app/dashboard/page.tsx (layout glue only)

No backend changes.

13) Quality gates (run from repo root)

npm ci

npm -w apps/dealer run build

npm -w apps/dealer run test