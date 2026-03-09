# Custom Role Migration Matrix

This matrix supports [`CUSTOM_ROLE_MIGRATION_REVIEW.md`](./CUSTOM_ROLE_MIGRATION_REVIEW.md).

| Entity type | Identifier or category | Old permission | Suggested canonical replacement | Replacement type | Widening risk | Action recommendation | Notes |
|---|---|---|---|---|---|---|---|
| system role | known seeded role by name | `audit.read` | `admin.audit.read` | Safe automatic replacement | none | handled by normalization script | not an open issue if script has run |
| template role | known DealerCenter `Role.key` | `audit.read` | `admin.audit.read` | Safe automatic replacement | none | handled by normalization script | not an open issue if script has run |
| custom role | `Role.isSystem = false` | `audit.read` | `admin.audit.read` | Safe automatic replacement | none | auto-replace if still present | direct alias only |
| user override | `UserPermissionOverride` | `audit.read` | `admin.audit.read` | Safe automatic replacement | none | auto-replace if still present | direct alias only |
| custom role | `Role.isSystem = false` | `inventory.publish.read` | `inventory.read` | Safe automatic replacement | none | auto-replace if still present | direct alias only |
| user override | `UserPermissionOverride` | `inventory.publish.read` | `inventory.read` | Safe automatic replacement | none | auto-replace if still present | direct alias only |
| custom role | `Role.isSystem = false` | `inventory.create` | `inventory.write` | Human-approved widening recommended | medium | review role intent first | removed CRUD key |
| custom role | `Role.isSystem = false` | `inventory.update` | `inventory.write` | Human-approved widening recommended | medium | review role intent first | removed CRUD key |
| custom role | `Role.isSystem = false` | `inventory.delete` | `inventory.write` | Human-approved widening recommended | medium | review role intent first | removed CRUD key |
| custom role | `Role.isSystem = false` | `inventory.export` | `inventory.write` | Human-approved widening recommended | medium | review role intent first | removed CRUD key |
| custom role | `Role.isSystem = false` | `customers.create` | `customers.write` | Human-approved widening recommended | medium | review role intent first | removed CRUD key |
| custom role | `Role.isSystem = false` | `customers.update` | `customers.write` | Human-approved widening recommended | medium | review role intent first | removed CRUD key |
| custom role | `Role.isSystem = false` | `customers.delete` | `customers.write` | Human-approved widening recommended | high | review role intent first | removed CRUD key |
| custom role | `Role.isSystem = false` | `customers.export` | `customers.write` | Human-approved widening recommended | medium | review role intent first | removed CRUD key |
| custom role | `Role.isSystem = false` | `crm.create` | `crm.write` | Human-approved widening recommended | medium | review role intent first | removed CRUD key |
| custom role | `Role.isSystem = false` | `crm.update` | `crm.write` | Human-approved widening recommended | medium | review role intent first | removed CRUD key |
| custom role | `Role.isSystem = false` | `crm.delete` | `crm.write` | Human-approved widening recommended | high | review role intent first | removed CRUD key |
| custom role | `Role.isSystem = false` | `crm.export` | `crm.write` | Human-approved widening recommended | medium | review role intent first | removed CRUD key |
| custom role | `Role.isSystem = false` | `deals.create` | `deals.write` | Human-approved widening recommended | medium | review role intent first | removed CRUD key |
| custom role | `Role.isSystem = false` | `deals.update` | `deals.write` | Human-approved widening recommended | medium | review role intent first | removed CRUD key |
| custom role | `Role.isSystem = false` | `deals.delete` | `deals.write` | Human-approved widening recommended | high | review role intent first | removed CRUD key |
| custom role | `Role.isSystem = false` | `deals.export` | `deals.write` | Human-approved widening recommended | medium | review role intent first | removed CRUD key |
| custom role | `Role.isSystem = false` | `deals.approve` | `deals.write` | Human-approved widening recommended | high | review role intent first | removed non-canonical action key |
| custom role | `Role.isSystem = false` | `finance.update` | `finance.write` | Human-approved widening recommended | medium | review role intent first | removed CRUD-style key |
| custom role | `Role.isSystem = false` | `finance.approve` | `finance.write` | Human-approved widening recommended | high | review role intent first | removed non-canonical action key |
| user override | `UserPermissionOverride` | any dormant CRUD/action key above | matching canonical `*.write` | Human-approved widening recommended | medium to high | approve per-user | per-user broadening |
| custom role or override | any live row | `platform.admin.read` | none | No canonical dealer replacement | n/a | leave unmapped and escalate if needed | wrong architectural layer |
| custom role or override | any live row | `platform.admin.write` | none | No canonical dealer replacement | n/a | leave unmapped and escalate if needed | wrong architectural layer |
| custom role or override | any live row | `platform.read` | none | No canonical dealer replacement | n/a | leave unmapped and escalate if needed | wrong architectural layer |
| custom role or override | any live row | `platform.write` | none | No canonical dealer replacement | n/a | leave unmapped and escalate if needed | wrong architectural layer |
| custom role or override | any live row | `platform.impersonate` | none | No canonical dealer replacement | n/a | leave unmapped and escalate if needed | wrong architectural layer |
| custom role or override | any live row | `appointments.read` | none | No canonical dealer replacement | n/a | leave unmapped | removed family |
| custom role or override | any live row | `appointments.create` | none | No canonical dealer replacement | n/a | leave unmapped | removed family |
| custom role or override | any live row | `appointments.update` | none | No canonical dealer replacement | n/a | leave unmapped | removed family |
| custom role or override | any live row | `appointments.cancel` | none | No canonical dealer replacement | n/a | leave unmapped | removed family |
| custom role or override | any live row | `bhph.read` | none | No canonical dealer replacement | n/a | leave unmapped | removed family |
| custom role or override | any live row | `bhph.write` | none | No canonical dealer replacement | n/a | leave unmapped | removed family |
| custom role or override | any live row | `integrations.read` | none | No canonical dealer replacement | n/a | leave unmapped | removed family |
| custom role or override | any live row | `integrations.manage` | none | No canonical dealer replacement | n/a | leave unmapped | removed family |
| custom role or override | any live row | `integrations.quickbooks.read` | none | No canonical dealer replacement | n/a | leave unmapped | removed family |
| custom role or override | any live row | `integrations.quickbooks.write` | none | No canonical dealer replacement | n/a | leave unmapped | removed family |
| historical environment | restored snapshot or manual import | any removed key | environment-specific | Needs environment-specific inspection | unknown | query first, then classify | repo cannot see live contents directly |
