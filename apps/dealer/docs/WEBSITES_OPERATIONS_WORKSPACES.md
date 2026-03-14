# Websites and Operations Workspaces

Dealer-facing workspaces for **Websites** and **Operations**. This doc captures UX targets and hierarchy. No public-website runtime or platform provisioning changes.

---

## Part A — Websites Workspace

### UX target

A dealer user should understand:

- **Current website health** — Status (draft/live/paused), published release
- **Readiness to publish** — Configured enough to go live
- **Branding/content status** — Theme, pages, domains
- **Website lead flow health** — Leads and attribution (via Analytics)

### Narrative

**Configure → Review → Publish**

1. **Configure**: Theme & branding, page configuration (SEO, sections), domains
2. **Review**: Check content and readiness on Publish page
3. **Publish**: Publish or rollback; monitor via Analytics

### Sections (overview)

| Section | Purpose |
|--------|---------|
| Brand & theme | Logo, colors, fonts, contact |
| Page configuration | Enable pages, SEO, section toggles |
| Publish & readiness | Publish, release history, readiness |
| Domains | Custom domains, verification, SSL |
| Analytics / lead flow | Page views, VDP views, lead attribution |

### Hierarchy

- **Websites** (workspace home): Overview with workspace framing and configure→review→publish narrative
- Theme & Branding, Page configuration, Publish, Domains, Analytics as direct links from overview and from nav

---

## Part B — Operations Workspace

### UX target

An operator/manager should understand:

- **Queue health** — How many items in Title, Delivery, Funding
- **Oldest stuck items** — Where aging is worst (drill into queue)
- **What needs intervention** — Link to each queue and to Tasks
- **Where to go next** — Clear path: Overview → Title & DMV | Delivery & Funding | Tasks

### Narrative

One **operations story**: post-deal workflow from title through delivery and funding, plus tasks/jobs.

- **Title & DMV** — Title work and DMV processing
- **Delivery & Funding** — Delivery status and funding status
- **Tasks** — CRM jobs and follow-up work

### Hierarchy

- **Operations** (workspace home): Overview with queue counts and links to each queue
- **Title & DMV**, **Delivery & Funding**, **Tasks** as direct links from overview and from nav (Operations children)

### Bottlenecks and aging

- Overview shows total counts per queue; detail pages (existing queue tables) show aging and filters
- No new backend; reuse existing queue APIs and list pages

---

## Constraints (this sprint)

- Do not redesign public website runtime
- Do not move platform-owned website provisioning into dealer
- Reuse existing queue surfaces and website surfaces
- Dealer-facing workspace framing and navigation only
