# DONE — Definition of Done (Per Module)

A module is considered DONE only when ALL items below are satisfied.

---

## 1) Schema & Data
- [ ] Prisma models added/updated for the module
- [ ] Migrations created and apply cleanly
- [ ] Required indexes exist (dealership_id + common filters)
- [ ] Soft delete implemented where appropriate (critical entities)
- [ ] Seed data updated if needed

---

## 2) Backend
- [ ] db layer functions exist under /modules/<module>/db
- [ ] service layer functions exist under /modules/<module>/service
- [ ] API routes exist under /app/api/** and call service layer only
- [ ] Zod validation for:
  - [ ] params
  - [ ] query
  - [ ] body
- [ ] Tenant scoping enforced for every query and write
- [ ] RBAC enforced for every route and sensitive read
- [ ] Pagination implemented with max limits
- [ ] Standard error shape implemented (AGENT_SPEC §8)

---

## 3) Audit & Security
- [ ] Audit logs written for:
  - [ ] create
  - [ ] update
  - [ ] delete (or soft delete)
  - [ ] sensitive reads (finance/docs/users/roles)
- [ ] No PII logged (mask or omit sensitive fields)
- [ ] File uploads (if any):
  - [ ] mime type validated
  - [ ] size limits enforced
  - [ ] signed URL access for private files
  - [ ] dealership scoping enforced
- [ ] Rate limiting applied to sensitive endpoints (auth/uploads/finance sessions)

---

## 4) Frontend (UI/UX)
- [ ] List page:
  - [ ] pagination
  - [ ] filters
  - [ ] empty state
  - [ ] loading state
  - [ ] error state
- [ ] Detail page:
  - [ ] readable layout
  - [ ] audit/metadata visible where useful
  - [ ] error state
- [ ] Create/Edit forms:
  - [ ] field validation
  - [ ] clear error messages
  - [ ] disabled/loading states
- [ ] UI consistency:
  - [ ] uses shared components
  - [ ] no duplicated “new design system”
- [ ] Accessibility:
  - [ ] labels
  - [ ] keyboard nav
  - [ ] focus states

---

## 5) Testing
- [ ] Unit tests for service logic (Vitest)
- [ ] Tenant isolation tests:
  - [ ] Dealer A cannot read Dealer B data
  - [ ] Dealer A cannot modify Dealer B data
- [ ] RBAC negative tests:
  - [ ] insufficient permission returns FORBIDDEN
- [ ] Audit log tests:
  - [ ] verify audit row created on critical actions
- [ ] Tests run and pass:
  - [ ] npm test

---

## 6) Quality Gates
- [ ] npm run lint passes
- [ ] npm run build passes
- [ ] No TODOs / placeholders / commented-out code
- [ ] Manual smoke checklist written in PR notes or /docs/TESTING.md

---

## 7) Docs
- [ ] Module documented in /docs/modules/<module>.md including:
  - [ ] purpose and scope
  - [ ] routes
  - [ ] permissions
  - [ ] data model summary
  - [ ] manual test steps
- [ ] Any new env vars documented in /docs/DEPLOYMENT.md