# SPRINT 4 — Customer Lead Action Strip (SPEC ONLY)

**Goal:** Enhance Customer Detail (Lead tab) with an Action Strip: Call, SMS, Email, Schedule Appointment, Add Task, Disposition. Mutations require `customers.write`; read-only hides mutation controls; contact/state-change actions log CustomerActivity; no PII in activity metadata or logs; XSS safety tests.

**Document type:** Specification only. No code, no Prisma, no TypeScript, no UI implementation.

**Compliance:** Multi-tenant (dealership_id on all queries), RBAC on every route, Zod at edge, pagination where applicable, audit/activity logging per DMS Non-Negotiables.

---

## 1) SCOPE

### In scope

- **Location:** Action Strip on Customer Detail — Lead tab (or equivalent “lead” context).
- **Six actions:**
  1. **Call** — Link using `tel:` with customer primary phone (or first phone). No API; no server round-trip.
  2. **SMS** — Opens modal; user may enter message (optional) and submit; on submit: send SMS (stub or real gateway later) and log CustomerActivity.
  3. **Email** — `mailto:` link with customer primary email. No API for opening mailto.
  4. **Schedule Appointment** — Modal (date, time, optional notes). On submit: create appointment (stub or in-memory) and log CustomerActivity.
  5. **Add Task** — Real API: POST create task for customer; log CustomerActivity.
  6. **Disposition** — Modal to set customer status (e.g. LEAD → ACTIVE, SOLD, INACTIVE) and optionally create follow-up task; log CustomerActivity.

### Action-by-action clarification

| Action | Server round-trip? | Logs CustomerActivity? | Activity type (if logged) | Metadata rule |
|--------|--------------------|-------------------------|----------------------------|---------------|
| **Call** | No (`tel:` only) | No | — | N/A |
| **Email** | No (`mailto:` only) | No | — | N/A |
| **SMS** | Yes (submit) | Yes | `sms_sent` | No PII (no phone, no message body); empty or truncated/hashed only |
| **Schedule Appointment** | Yes (submit) | Yes | `appointment_scheduled` | appointmentId or slot; no PII |
| **Add Task** | Yes (POST task) | Yes | `task_created` | taskId only; no PII |
| **Disposition** | Yes (PATCH + optional task) | Yes | `disposition_set` | fromStatus, toStatus, taskId?; no PII |

- **Call:** Client-only `tel:` link. No activity log for click. (If product later requires “call initiated,” define activity type and minimal non-PII metadata; for this spec, Call does not log.)
- **Email:** Client-only `mailto:` link. No activity log. (Optional “email_click” would require customers.write and no PII in metadata; spec chooses no log for mailto.)
- **SMS:** Modal; on submit either (a) stub send + log activity, or (b) log-only (no real send) with activity. MVP may be “log only” with activity; gateway integration out of scope.
- **Schedule Appointment:** Stub appointment entity or in-memory; activity record required.
- **Add Task:** Real API (existing or newly defined POST); activity required.
- **Disposition:** PATCH customer status and optional follow-up task; activity required.

### Permission visibility (recommendation)

- **customers.read only:** Show Call and Email (links only; no server call, no log). Hide or disable SMS, Schedule Appointment, Add Task, Disposition.
- **customers.write:** All six actions visible; all mutations (SMS submit, Schedule Appointment submit, Add Task, Disposition submit) allowed; every mutation that hits the server logs CustomerActivity.

### Out of scope

- Real SMS or email gateway integration (stub OK).
- Full calendar or complex scheduling engine.
- Workflow engine or automation beyond logging activity.

---

## 2) DATA / API CONTRACT

All endpoints are tenant-scoped: `dealership_id` from auth/context; customer must belong to tenant; validate customer ownership on every request.

### Add Task

- **Route:** `POST /api/customers/[id]/tasks`
- **Permission:** `customers.write`
- **Body (conceptual):** `{ title: string (required), dueAt?: string (ISO datetime), description?: string }`
- **Validation:** title required, length limits; dueAt valid ISO; description optional, length limits. Zod at edge.
- **Response:** 201 with created task (id, title, dueAt, description, customerId, etc.).
- **Side effect:** Log CustomerActivity: entityType customer, entityId customerId, activityType `task_created`, metadata `{ taskId }` (no PII).

### Log activity (shared)

- **Route:** `POST /api/customers/[id]/activity`
- **Permission:** `customers.write`
- **Body (conceptual):** `{ activityType: string (enum), metadata?: object }`
- **Validation:** activityType required, from allowed set (e.g. sms_sent, appointment_scheduled, task_created, disposition_set); metadata optional, schema per type; no PII allowed in metadata.
- **Response:** 201 with activity record.
- **Usage:** May be called inline by other actions (e.g. SMS submit, Schedule Appointment submit, Disposition) or as a dedicated endpoint; spec allows either. All mutation flows must result in one activity record per logical action.

### Disposition

- **Option A:** `PATCH /api/customers/[id]` with `{ status }` plus separate `POST /api/customers/[id]/tasks` for follow-up if requested.
- **Option B (recommended):** Dedicated `POST /api/customers/[id]/disposition` with body `{ status: enum, followUpTask?: { title: string, dueAt?: string } }`.
- **Permission:** `customers.write`
- **Validation:** status in CustomerStatus enum; followUpTask optional; title/dueAt validated if present.
- **Response:** 200 or 201; if follow-up task created, include taskId in response or in activity metadata.
- **Side effect:** Update customer status; create follow-up task if provided; log CustomerActivity `disposition_set` with metadata `{ fromStatus, toStatus, taskId? }` (no PII).

### Schedule Appointment (stub)

- **Option A:** `POST /api/customers/[id]/appointments` (stub) — creates minimal appointment record or in-memory stub; then log activity.
- **Option B:** No separate appointment entity; `POST /api/customers/[id]/activity` with activityType `appointment_scheduled` and metadata `{ scheduledAt (ISO), notesTruncated?: string }` (notes truncated/non-PII only; no customer name/phone in metadata).
- **Permission:** `customers.write`
- **Body (conceptual):** `{ scheduledAt: string (ISO), notes?: string }` — notes not stored as PII in activity metadata (truncate or omit).
- **Response:** 201.
- **Document:** Stub; no full calendar; activity is required.

### SMS (stub)

- **Option A:** `POST /api/customers/[id]/activity` with activityType `sms_sent`; metadata empty or `{ truncated }` only — no message body, no phone.
- **Option B:** `POST /api/customers/[id]/sms` (stub) that logs activity and returns 201; request body may include message for future gateway use but must not be stored in activity metadata.
- **Permission:** `customers.write`
- **Response:** 201.
- **Metadata:** Must not contain phone number or message content (PII).

### Response and error shape

- **Success:** 200/201 with resource or `{ data: T }` as appropriate.
- **Error:** Consistent shape `{ error: { code: string, message: string, details?: unknown } }`.
- **Pagination:** Not required for single-resource or single-activity create; list endpoints (if any) use limit/offset or cursor.

### Dealership scoping

- `dealership_id` resolved from auth/context (or path where applicable); never from client body.
- Every list/get/update/delete scoped by tenant; customer must belong to tenant; otherwise 404.

---

## 3) RBAC + TENANT

### RBAC matrix (resource: Customer Lead actions)

| Action | customers.read | customers.write |
|--------|----------------|-----------------|
| View Action Strip | Yes | Yes |
| Call (tel: link) | Visible, allowed | Visible, allowed |
| Email (mailto: link) | Visible, allowed | Visible, allowed |
| SMS (open modal, submit) | Hidden or disabled | Visible, allowed |
| Schedule Appointment (modal, submit) | Hidden or disabled | Visible, allowed |
| Add Task (modal/form, submit) | Hidden or disabled | Visible, allowed |
| Disposition (modal, submit) | Hidden or disabled | Visible, allowed |

- **Least privilege:** No admin bypass; mutation actions require `customers.write`.
- **Read-only:** With only `customers.read`, mutation buttons (SMS, Schedule Appointment, Add Task, Disposition) are not visible or are disabled.

### Tenant scoping rules

- Every API call uses `ctx.dealershipId` (or equivalent from auth).
- Customer must belong to tenant; lookup by id must include `dealership_id` predicate.
- Cross-tenant access forbidden: other tenant’s customerId returns 404, not 403.
- No endpoint returns or mutates another tenant’s data.

### Sensitive reads

- Customer detail and activity timeline are sensitive; ensure only tenant-scoped and permission-gated. Activity log is append-only; no PII in metadata (see PII and audit).

---

## 4) PII AND AUDIT

### Activity metadata

- **No PII in activity metadata:** No email, no phone, no message body, no customer name. Only IDs (e.g. taskId, appointmentId), status enums (fromStatus, toStatus), timestamps (scheduledAt as non-identifying slot), and similar non-PII.
- **CustomerActivity:** Append-only; store only non-PII metadata per action type.

### Application logs

- No PII in application logs (no request/response body logging that contains email, phone, message content, customer name).
- Log only identifiers (e.g. customerId, taskId) and error codes/messages that do not include user data.

### Audit

- Customer status change (disposition) and task creation are critical; ensure audit logging for customer update and task create where applicable (per existing DMS audit rules). Activity table is append-only timeline; no CUD audit on activity rows themselves.

---

## 5) FRONTEND CONTRACT

### Action Strip layout

- **Presentation:** Horizontal row of buttons/links.
- **Call:** Link with `tel:` and customer primary (or first) phone.
- **Email:** Link with `mailto:` and customer primary email.
- **SMS, Schedule Appointment, Add Task, Disposition:** Buttons that open modals or inline forms (no navigation).

### Read-only behavior

- When user lacks `customers.write`: hide or disable SMS, Schedule Appointment, Add Task, Disposition. Show Call and Email if customer has phone/email.

### Modals and forms

- **SMS:** Message input optional; submit = log activity + optional stub send. No message body in activity metadata.
- **Schedule Appointment:** Date, time, optional notes; submit = stub create + log activity. Notes not stored as PII in metadata.
- **Disposition:** Status dropdown (e.g. LEAD, ACTIVE, SOLD, INACTIVE); optional follow-up task (title, dueAt). Submit = PATCH status (or POST disposition) + create task if requested + log activity.
- **Add Task:** Modal or inline form (title, dueAt?, description?); submit = POST task + log activity.

### XSS safety

- All user-supplied content (message in SMS, notes in appointment, task title/description) must be escaped when rendered.
- No `dangerouslySetInnerHTML` with user content. Inputs are controlled; output is text or safe components only.

### UX

- Loading and error state per action; toasts (or equivalent) for success and error.

---

## 6) TEST REQUIREMENTS (for implementation phase)

### XSS safety tests

- **Scope:** Action strip and/or modals that render customer name, task title, or notes.
- **Setup:** Render with content containing script/HTML (e.g. `"<script>alert(1)</script>"`, `"<img onerror=alert(1)>"`).
- **Assert:** No script runs; content is escaped and visible as text, not executed. Use React Testing Library and jsdom.

### Permission tests

- With only `customers.read`: Mutation buttons (SMS, Schedule Appointment, Add Task, Disposition) are not visible or are disabled.
- With `customers.write`: All mutation actions are visible and enabled.

### Tenant isolation (backend)

- Disposition, Add Task, and log-activity succeed only when customer belongs to tenant.
- Request with other tenant’s customerId returns 404 (not 403).

### No PII in activity (backend)

- After logging activity for SMS or appointment, assert stored metadata does not contain email, phone, or message body.

---

## DELIVERABLES CHECKLIST

- [ ] SCOPE: Action Strip with six actions; Call/Email no log; SMS, Schedule Appointment, Add Task, Disposition log activity; permission visibility defined.
- [ ] DATA/API: POST task, POST activity (or inline), disposition endpoint (or PATCH + task), appointment stub, SMS stub; all tenant-scoped; Zod at edge; response/error shape.
- [ ] RBAC: customers.read vs customers.write matrix; tenant scoping rules; no cross-tenant access.
- [ ] PII/AUDIT: No PII in activity metadata or app logs; append-only activity; audit for customer/task where applicable.
- [ ] FRONTEND CONTRACT: Action strip layout; read-only behavior; modal behavior; XSS rules; loading/error and toasts.
- [ ] TEST REQUIREMENTS: XSS safety tests; permission tests; tenant backend tests; no-PII-in-activity backend test.

**Next step:** Backend implements APIs (task, activity, disposition, stubs), validation, and tests; frontend implements action strip and modals.
