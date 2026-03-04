# List endpoint pagination verification

All list endpoints must paginate (limit/offset or cursor) with a bounded max. This document lists each list API and confirms pagination.

| Endpoint | Limit/offset | Max limit | Verified |
|----------|--------------|-----------|----------|
| GET /api/audit | limit, offset | 100 | ✓ |
| GET /api/admin/roles | limit, offset | 100 | ✓ |
| GET /api/admin/memberships | limit, offset | 100 | ✓ |
| GET /api/admin/permissions | limit, offset | 100 | ✓ |
| GET /api/admin/dealership/locations | limit, offset | 100 | ✓ |
| GET /api/platform/dealerships | limit, offset | 100 | ✓ |
| GET /api/platform/dealerships/[id]/members | limit, offset | 100 | ✓ |
| GET /api/customers | limit, offset | 100 | ✓ |
| GET /api/customers/[id]/notes | limit, offset | 100 | ✓ |
| GET /api/customers/[id]/tasks | limit, offset | 100 | ✓ |
| GET /api/customers/[id]/activity | limit, offset | 100 | ✓ |
| GET /api/deals | limit, offset | 100 | ✓ |
| GET /api/deals/[id]/history | limit, offset | 100 | ✓ |
| GET /api/deals/[id]/applications | limit, offset | 100 | ✓ |
| GET /api/deals/[id]/applications/[appId]/submissions | limit, offset | 100 | ✓ |
| GET /api/deals/[id]/applications/.../submissions/.../stipulations | limit, offset | 100 | ✓ |
| GET /api/deals/[id]/finance/products | limit, offset | 100 | ✓ |
| GET /api/documents | limit, offset | 100 | ✓ |
| GET /api/inventory | limit, offset | 100 | ✓ |
| GET /api/inventory/aging | limit, offset | 100 | ✓ |
| GET /api/lenders | limit, offset | 100 | ✓ |
| GET /api/crm/pipelines | limit, offset | 100 | ✓ |
| GET /api/crm/opportunities | limit, offset | 100 | ✓ |
| GET /api/crm/opportunities/[id]/activity | limit, offset | 100 | ✓ |
| GET /api/crm/automation-rules | limit, offset | 100 | ✓ |
| GET /api/crm/sequence-templates | limit, offset | 100 | ✓ |
| GET /api/crm/jobs | limit, offset | 100 | ✓ |
| GET /api/reports/sales-by-user | limit, offset | 100 | ✓ |
| GET /api/search | limit, offset | 50 (cap) | ✓ |

Export endpoints (GET /api/reports/export/inventory, GET /api/reports/export/sales) return a single CSV stream; they are rate-limited and audited, not list endpoints.
