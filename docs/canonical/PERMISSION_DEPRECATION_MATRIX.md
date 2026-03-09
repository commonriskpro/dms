# Permission Deprecation Matrix

Historical note:
- This matrix records the pre-normalization deprecation plan inputs.
- The current normalized dealer permission model is recorded in [`RBAC_NORMALIZATION_REPORT.md`](./RBAC_NORMALIZATION_REPORT.md).

This matrix is the planning companion to [`PERMISSION_DEPRECATION_PLAN.md`](./PERMISSION_DEPRECATION_PLAN.md).

It does not change behavior. It records which non-canonical dealer permissions should be treated as reserved, legacy, wrong-layer, or future removal candidates.

| Permission / family | Current bucket | Current status | Why non-canonical | Current risk of removal | Verification needed before future change | Current recommended treatment |
|---|---|---|---|---|---|---|
| `platform.admin.read` | `D`, `E`, `F` | Seeded in [`apps/dealer/prisma/seed.ts`](../../apps/dealer/prisma/seed.ts), not runtime-enforced | Platform access uses [`apps/dealer/lib/platform-admin.ts`](../../apps/dealer/lib/platform-admin.ts) and [`apps/platform/lib/platform-auth.ts`](../../apps/platform/lib/platform-auth.ts), not dealer permission strings | Medium | inspect persisted role/override data and any external provisioning/admin tooling | Mark wrong-layer; do not remove yet |
| `platform.admin.write` | `D`, `E`, `F` | Seeded only | Same as above | Medium | Same as above | Mark wrong-layer; do not remove yet |
| `platform.read` | `D`, `E`, `F` | Seeded only | Same as above | Medium | Same as above | Mark wrong-layer; do not remove yet |
| `platform.write` | `D`, `E`, `F` | Seeded only | Same as above | Medium | Same as above | Mark wrong-layer; do not remove yet |
| `platform.impersonate` | `D`, `E`, `F` | Seeded only | Same as above | Medium | Same as above | Mark wrong-layer; do not remove yet |
| `inventory.create` | `B` | Seeded and assigned in role templates, not runtime-enforced | Dealer runtime uses `inventory.read` / `inventory.write` instead | High | product decision on fine-grained RBAC, plus persisted role audit | Keep reserved |
| `inventory.update` | `B` | Seeded/template only in live catalog | Same as above | High | Same as above | Keep reserved |
| `inventory.delete` | `B` | Seeded/template only in live catalog | Same as above | High | Same as above | Keep reserved |
| `inventory.export` | `B` | Seeded/template only in live catalog | Same as above | High | Same as above | Keep reserved |
| `customers.create` | `B` | Seeded/template only | Dealer runtime uses `customers.read` / `customers.write` | High | product decision plus persisted role audit | Keep reserved |
| `customers.update` | `B` | Seeded/template only | Same as above | High | Same as above | Keep reserved |
| `customers.delete` | `B` | Seeded/template only | Same as above | High | Same as above | Keep reserved |
| `customers.export` | `B` | Seeded/template only | Same as above | High | Same as above | Keep reserved |
| `crm.create` | `B` | Seeded/template only | Dealer runtime uses `crm.read` / `crm.write` | High | product decision plus persisted role audit | Keep reserved |
| `crm.update` | `B` | Seeded/template only | Same as above | High | Same as above | Keep reserved |
| `crm.delete` | `B` | Seeded/template only | Same as above | High | Same as above | Keep reserved |
| `crm.export` | `B` | Seeded/template only | Same as above | High | Same as above | Keep reserved |
| `deals.create` | `B` | Seeded/template only | Dealer runtime uses `deals.read` / `deals.write` | High | product decision plus persisted role audit | Keep reserved |
| `deals.update` | `B` | Seeded/template only | Same as above | High | Same as above | Keep reserved |
| `deals.delete` | `B` | Seeded/template only | Same as above | High | Same as above | Keep reserved |
| `deals.export` | `B` | Seeded/template only | Same as above | High | Same as above | Keep reserved |
| `deals.approve` | `B` | Seeded/template only | Same as above | High | Same as above | Keep reserved |
| `finance.update` | `B` | Seeded/template only | Dealer runtime uses `finance.read` / `finance.write` and `finance.submissions.*` | High | product decision plus persisted role audit | Keep reserved |
| `finance.approve` | `B` | Seeded/template only | Same as above | High | Same as above | Keep reserved |
| `audit.read` | `C`, `F` | Superseded alias; removed from current dealer seed catalog | Canonical name is `admin.audit.read` | Low in code, unknown in data | inspect persisted role/override data and any old scripts/runbooks | Keep historical only; migrate any stale data before final retirement |
| `appointments.read` | `G` | Seeded only | No runtime enforcement; product intent unclear | Medium to high | product confirmation plus persisted role audit | Hold for confirmation |
| `appointments.create` | `G` | Seeded only | Same as above | Medium to high | Same as above | Hold for confirmation |
| `appointments.update` | `G` | Seeded only | Same as above | Medium to high | Same as above | Hold for confirmation |
| `appointments.cancel` | `G` | Seeded only | Same as above | Medium to high | Same as above | Hold for confirmation |
| `bhph.read` | `G` | Seeded only | No runtime enforcement; repo does not prove product status | High | product confirmation plus persisted role audit | Hold for confirmation |
| `bhph.write` | `G` | Seeded only | Same as above | High | Same as above | Hold for confirmation |
| `integrations.read` | `G` | Seeded only | Repo has real integrations, but not this permission family in runtime enforcement | Medium to high | product confirmation plus persisted role audit | Hold for confirmation |
| `integrations.manage` | `G` | Seeded only | Same as above | Medium to high | Same as above | Hold for confirmation |
| `integrations.quickbooks.read` | `G` | Seeded only | QuickBooks permission family exists in seed only | Medium to high | product confirmation plus persisted role audit | Hold for confirmation |
| `integrations.quickbooks.write` | `G` | Seeded only | Same as above | Medium to high | Same as above | Hold for confirmation |

## Reading Notes

- `B` means reserved but not enforced.
- `C` means legacy alias / superseded.
- `D` means wrong architectural layer.
- `E` means deprecation candidate.
- `F` means removal candidate only after migration verification.
- `G` means human confirmation is required before any deprecation decision.
