
# DMS Dealer App UI System Architecture

Version: v1  
Status: Authoritative  
Owner: Platform UI Architecture  
Last Updated: 2026-03  

---

## Overview

This document defines the **official UI architecture** for the Dealer App.

It establishes the visual, structural, and interaction standards that ensure the interface remains consistent, scalable, and maintainable across all modules.

This specification governs:

• layout system  
• sidebar navigation system  
• page archetypes  
• dashboard widgets  
• tables and queues  
• entity detail pages  
• modal architecture  
• component standards  
• interaction patterns  
• visual design tokens  
• workflow mapping  

All new UI development **must follow this specification**.

Supporting documents may expand on specific systems but **cannot override this architecture**.

---

# 1. Design Philosophy

The Dealer App is designed as a **workflow operating system for dealerships**.

The interface prioritizes operational clarity and speed of execution over decorative design.

Core principles:

### Workflow-first
The UI reflects dealership workflows rather than technical modules.

### Shell-first
Every page uses the same structural layout to maintain predictability.

### Token-driven
Visual styling is defined through centralized design tokens.

### Pattern reuse
Common UI patterns are reused across all modules.

### Predictable interactions
User actions behave consistently across the application.

### Non-breaking evolution
UI improvements must not break existing backend functionality.

---

# 2. Layout System

All authenticated pages use the **PageShell layout system**.

### PageShell Structure

PageHeader
--------------------------------
FilterBar / Search
--------------------------------
Primary Content Area
--------------------------------
ContextRail (optional)

### Layout Rules

1. All pages must use `PageShell`
2. Sidebar is persistent across authenticated pages
3. PageHeader must appear on every page
4. FilterBar appears on list and queue pages
5. ContextRail is optional but recommended
6. No custom page layouts outside PageShell

---

# 3. Navigation System

Primary navigation follows **domain-driven grouping**.

### Primary Navigation

Dashboard  
Inventory  
CRM  
Deals  
Operations  
Finance  
Reports  
Admin  

Navigation should always reflect **workflow groupings**, not individual pages.

Sub-navigation is contextual to the active section.

Navigation must respect **RBAC permissions**.

---

# 4. Page Archetypes

The system supports **five standardized page types**.

## Dashboard Page

Structure:

PageHeader  
KPI Row  
Widget Grid  
ContextRail  

Typical widgets:

• inventory alerts  
• deal pipeline  
• CRM tasks  
• messaging preview  
• acquisition insights  

---

## List Pages

Examples:

• Inventory  
• Customers  
• Deals  
• Reports  

Structure:

PageHeader  
FilterBar  
TableLayout  
ContextRail (optional)

---

## Detail Pages

Examples:

• Customer  
• Vehicle  
• Deal  
• Opportunity  

Structure:

Entity Header  
Primary Workspace  
Activity Timeline  
Related Entities  
ContextRail  

---

## Queue Pages

Examples:

• Delivery queue  
• Funding queue  
• Title queue  
• CRM automation jobs  

Structure:

QueueHeader  
QueueKPIs  
QueueTable  
QueueActions  

---

## Board Pages

Examples:

• CRM pipeline  
• opportunity board  

Structure:

PageHeader  
FilterBar  
KanbanBoard  
ContextRail  

---

# 5. Dashboard Widget System

### Widget Anatomy

Title  
Subtitle (optional)  
Action button (optional)  
Content  
Empty state  
Loading state  
Error state  

### Widget Categories

KPI widgets  
List widgets  
Insight widgets  
Queue snapshots  
Activity feeds  
Action panels  

---

# 6. Table System

### Table Components

TableToolbar  
ColumnHeader  
DataRows  
StatusBadge  
RowActions  
Pagination  

### Table Features

• sorting  
• filtering  
• column visibility  
• pagination  
• row actions  

Tables must support loading, empty, and error states.

---

# 7. Queue System

Queues represent operational workflows.

Examples:

Delivery Queue  
Funding Queue  
Title Queue  
CRM Job Queue  

### Queue Layout

QueueHeader  
QueueKPIs  
QueueTable  
QueueActions  

---

# 8. Detail Page System

Shared structure:

Entity Header  
Primary Workspace  
Timeline  
Related Entities  
ContextRail  

Example sections for Deal Workspace:

• deal summary  
• customer information  
• vehicle details  
• trade information  
• finance products  
• delivery status  
• funding status  
• title workflow  

---

# 9. Modal System

Rules:

• modal + full page share logic  
• intercepting routes  
• canonical routes per entity  
• safe direct navigation  

---

# 10. Component System

Shared components include:

MetricCard  
QueueTable  
KanbanBoard  
AlertCard  
ActivityTimeline  
EntityHeader  

Module-specific components remain within their domain modules.

---

# 11. Interaction Patterns

Standard behaviors:

• status badges  
• loading indicators  
• form validation patterns  
• timeline events  
• dropdown menus  

---

# 12. Visual Design Tokens

All styling must use shared design tokens.

Token categories:

• colors  
• typography  
• spacing  
• radius  
• shadows  
• transitions  

---

# 13. Workflow Mapping

UI architecture aligns with these domains:

Inventory  
CRM  
Deals  
Operations  
Finance  
Reports  

---

# 14. Governance Rules

1. PageShell is mandatory  
2. Tables must use TableLayout  
3. Queues must use QueueLayout  
4. Shared components must be reused  
5. Tokens must be used for styling  
6. No one-off UI patterns allowed  

---

# 15. Implementation Roadmap

### Phase 1
Core layout infrastructure

• PageShell  
• PageHeader  
• FilterBar  
• ContextRail  

### Phase 2
Navigation system rebuild

### Phase 3
Dashboard widget standardization

### Phase 4
Inventory, CRM, Deals UI migration

### Phase 5
Operational queues

### Phase 6
Finance and reporting UI

### Phase 7
Accessibility and performance hardening

---

# Conclusion

This architecture defines the **long-term UI foundation** of the Dealer App.

Benefits:

• consistent user experience  
• scalable UI architecture  
• faster development velocity  
• easier onboarding for developers  
• long-term product stability
