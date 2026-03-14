# Commercial Journey Alignment

Purpose: align Sales, CRM, and Deals so they feel like one commercial journey (lead → contact → appointment → opportunity → deal) without merging modules.

## 1. Narrative

**Journey:** Lead → Contact → Appointment → Opportunity → Deal

- **Lead:** New prospect (Customers, Add lead).
- **Contact:** First touch, callbacks, tasks (CRM Command Center, Inbox, Customers).
- **Appointment:** Scheduled engagement (callbacks, inbox, pipeline stages).
- **Opportunity:** Pipeline stage with owner and next action (CRM Pipeline, Command Center).
- **Deal:** Structured deal in the desk (Deals board, Title/Delivery/Funding queues).

## 2. When to use each surface

| Surface | Use when |
|--------|----------|
| **Sales** | Start of day, “my day” view: what needs attention, who to follow up, where to go next. Entry point; then go to CRM or Deals. |
| **CRM** | Follow-up work: due now, stale prospects, pipeline blockers, inbox. Move opportunities through stages; create deal when ready. |
| **Deals** | Deal in motion: structure, approve, contract, title, delivery, funding. Deal risk or follow-up gaps → back to CRM/Customers. |
| **Customers** | Relationship view: book health, fresh/stale leads, callbacks. Add lead, open customer to call/message/schedule/deal. |

## 3. Transitions

- **Opportunity → Deal:** From opportunity detail or pipeline, use “Create deal” to start a deal (links to Deals).
- **Deal risk / follow-up → CRM:** From deal or Sales, use “Command center” or “Pipeline” or “Inbox” to return to follow-up.
- **Inbox → context:** Inbox and Command Center use links to customer and opportunity so rep sees full context.

## 4. Shared language

Use consistent terms across Sales, CRM, and Deals:

| Concept | Term | Notes |
|--------|------|--------|
| Urgency | Due now | Callbacks, tasks, conversations due immediately. |
| Urgency | Overdue | Past due; use danger/warning where applicable. |
| Urgency | Needs attention | Generic “needs action” without overloading. |
| Status | Open | Opportunity/deal still in progress. |
| Status | Won / Lost | Opportunity outcome. |
| Status | Draft / Structured / Approved / Contracted | Deal lifecycle. |
| Next action | Next action | Single phrase; “next step” or “commitment” in context. |
| Ownership | Owner / Assigned to | Same concept in CRM and Deals. |
| Progression | Stage | Pipeline stage (CRM); deal status (Deals). |

**Visual:** Use existing `StatusBadge` variants (success, warning, danger, info) for severity and state. No new components required.

## 5. In-product affordances

- **Sales:** Quick actions to Command center, Pipeline, Inbox, Deals; New opportunity, Add lead, New deal. One-line journey reminder.
- **CRM Command Center:** Quick links to Sales, Pipeline, Inbox, Deals. Description ties to follow-up and pipeline.
- **CRM Opportunity detail:** “Create deal” when opportunity has no linked deal; Customer, Inbox, Back to pipeline.
- **Deals board:** PageHeader with title and short journey line; links to Sales and CRM Pipeline so users can switch context.

## 6. No changes

- Backend and routes unchanged.
- Permissions unchanged (crm.read/write, deals.read/write, customers.read/write).
- Navigation structure (Workspaces + Daily work) unchanged; only in-page copy and transition links added.
