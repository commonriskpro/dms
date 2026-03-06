# DMS Module Blueprint

This document defines the complete module structure, responsibilities, and build order for the Dealer Management System (DMS).

The system is a modular monolith.
Each module lives under:

/modules/<module>/{ui,service,db,tests}

All modules must follow AGENT_SPEC.md and DONE.md rules.

---

# BUILD ORDER (STRICT)

Phase 0 – Core Platform
1. core-platform (tenancy, RBAC, audit, files)

Phase 1 – Core DMS
2. inventory
3. customers
4. deals
5. documents

Phase 2 – Finance & Reporting
6. finance
7. reports

Phase 3 – Revenue Modules
8. bhph
9. quickbooks
10. crm-pro

Phase 4 – Growth
11. website
12. syndication
13. valuations

Phase 5 – Optional Advanced
14. credit-bureau

Modules must be built in order unless explicitly approved.

---

# MODULE DEFINITIONS

---

## 1. core-platform

Responsibilities:
- Multi-tenant model (dealerships, locations)
- User profiles
- Memberships (user ↔ dealership)
- Roles and permissions
- RBAC enforcement helpers
- Tenant scoping helpers
- Audit log (append-only)
- File metadata storage
- Auth integration (Supabase)

Must enforce:
- All business tables include dealership_id
- RBAC on all routes
- Audit logging on sensitive actions

---

## 2. inventory

Responsibilities:
- Vehicle CRUD
- VIN decode integration
- Vehicle photos (Supabase Storage)
- Pricing & acquisition cost tracking
- Status workflow (available, pending, sold, wholesale)
- Inventory aging report

Must include:
- Pagination
- Filters
- Indexes on dealership_id + status + created_at

---

## 3. customers

Responsibilities:
- Customer profiles
- Lead source tracking
- Contact info
- Notes & activity timeline
- Basic CRM task tracking

Must NOT:
- Store SSN in MVP

---

## 4. deals

Responsibilities:
- Deal structuring
- Trade-in support
- Fees & add-ons
- Payment calculator
- APR/term calculations
- Deal status workflow
- Deal summary generation

Depends on:
- inventory
- customers

---

## 5. documents

Responsibilities:
- Document uploads (deal/customer/vehicle)
- Template management
- PDF generation
- Signed URL access
- Retention tagging

Must use:
- Supabase Storage
- Private buckets for sensitive docs

---

## 6. finance

Responsibilities:
- Finance application shell
- Lender session (embed/redirect)
- Stipulations tracking
- Funding status timeline
- External application ID storage

Must NOT:
- Store SSN/DOB/income (unless phase 5)

---

## 7. reports

Responsibilities:
- Sales reports
- Inventory turn
- Gross per deal
- Finance penetration rate
- Export CSV

---

## 8. bhph (Buy Here Pay Here)

Responsibilities:
- In-house financing contracts
- Payment schedules
- Ledger tracking
- Late fees
- Delinquency dashboard
- ACH integration (tokenized only)

Must NOT:
- Store raw card data

---

## 9. quickbooks

Responsibilities:
- Chart of accounts mapping
- Transaction sync
- Idempotent job processing
- Audit sync history

---

## 10. crm-pro

Responsibilities:
- Automated follow-ups
- SMS/email campaigns
- Lead assignment rules
- Funnel analytics

---

## 11. website

Responsibilities:
- Inventory feed endpoint
- Lead capture → CRM
- Payment estimator widget
- SEO pages

---

## 12. syndication

Responsibilities:
- Export inventory feeds
- Marketplace integrations
- Feed scheduling

---

## 13. valuations

Responsibilities:
- External valuation API integration
- Store pricing snapshots
- Optional paid add-on

---

## 14. credit-bureau (ADVANCED – LAST)

Responsibilities:
- Credit report integration
- Consent capture
- Adverse action workflow
- Strict RBAC and audit logs

High compliance risk.
Must not be built until platform is stable.

---

# CROSS-MODULE RULES

1. No module may directly query another module’s DB layer.
   Use service layer calls only.

2. No business logic in UI.

3. Every module must:
   - enforce tenant scoping
   - enforce RBAC
   - write audit logs
   - include tests

4. All list endpoints must paginate.

5. Every module must pass DONE.md before moving to next.

---

# REVENUE TIER MAPPING

Core Plan:
- inventory
- customers
- deals
- documents
- finance-lite
- basic reports

Add-ons:
- bhph
- quickbooks
- crm-pro
- website
- syndication
- valuations
- credit-bureau

---

# IMPORTANT

Cursor agents must:
- Build modules in order
- Complete one module fully before starting another
- Never scaffold all modules at once
- Never skip RBAC, tenant scoping, or audit logs