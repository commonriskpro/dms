# RBAC Live SQL Checklist

This checklist supports [`RBAC_LIVE_ROLLOUT_RUNBOOK.md`](./RBAC_LIVE_ROLLOUT_RUNBOOK.md).

These queries are derived from the Prisma models in [`apps/dealer/prisma/schema.prisma`](../../apps/dealer/prisma/schema.prisma):
- `"Permission"`
- `"Role"`
- `"RolePermission"`
- `"UserPermissionOverride"`
- `"Membership"`
- `"UserRole"`

These examples assume PostgreSQL and quoted identifiers.

## 1. Obsolete Key Set

Use this common CTE in the queries below.

```sql
WITH obsolete_keys AS (
  SELECT unnest(ARRAY[
    'audit.read',
    'inventory.publish.read',
    'platform.admin.read',
    'platform.admin.write',
    'platform.read',
    'platform.write',
    'platform.impersonate',
    'inventory.create',
    'inventory.update',
    'inventory.delete',
    'inventory.export',
    'customers.create',
    'customers.update',
    'customers.delete',
    'customers.export',
    'crm.create',
    'crm.update',
    'crm.delete',
    'crm.export',
    'deals.create',
    'deals.update',
    'deals.delete',
    'deals.export',
    'deals.approve',
    'appointments.read',
    'appointments.create',
    'appointments.update',
    'appointments.cancel',
    'finance.update',
    'finance.approve',
    'bhph.read',
    'bhph.write',
    'integrations.read',
    'integrations.manage',
    'integrations.quickbooks.read',
    'integrations.quickbooks.write'
  ]) AS key
)
```

## 2. Pre-Run: Count Obsolete Permission Rows

```sql
WITH obsolete_keys AS (
  SELECT unnest(ARRAY[
    'audit.read',
    'inventory.publish.read',
    'platform.admin.read',
    'platform.admin.write',
    'platform.read',
    'platform.write',
    'platform.impersonate',
    'inventory.create',
    'inventory.update',
    'inventory.delete',
    'inventory.export',
    'customers.create',
    'customers.update',
    'customers.delete',
    'customers.export',
    'crm.create',
    'crm.update',
    'crm.delete',
    'crm.export',
    'deals.create',
    'deals.update',
    'deals.delete',
    'deals.export',
    'deals.approve',
    'appointments.read',
    'appointments.create',
    'appointments.update',
    'appointments.cancel',
    'finance.update',
    'finance.approve',
    'bhph.read',
    'bhph.write',
    'integrations.read',
    'integrations.manage',
    'integrations.quickbooks.read',
    'integrations.quickbooks.write'
  ]) AS key
)
SELECT p."key", COUNT(*) AS row_count
FROM "Permission" p
JOIN obsolete_keys ok ON ok.key = p."key"
GROUP BY p."key"
ORDER BY p."key";
```

## 3. Pre-Run: Custom Roles With Obsolete Permissions

```sql
WITH obsolete_keys AS (
  SELECT unnest(ARRAY[
    'audit.read',
    'inventory.publish.read',
    'platform.admin.read',
    'platform.admin.write',
    'platform.read',
    'platform.write',
    'platform.impersonate',
    'inventory.create',
    'inventory.update',
    'inventory.delete',
    'inventory.export',
    'customers.create',
    'customers.update',
    'customers.delete',
    'customers.export',
    'crm.create',
    'crm.update',
    'crm.delete',
    'crm.export',
    'deals.create',
    'deals.update',
    'deals.delete',
    'deals.export',
    'deals.approve',
    'appointments.read',
    'appointments.create',
    'appointments.update',
    'appointments.cancel',
    'finance.update',
    'finance.approve',
    'bhph.read',
    'bhph.write',
    'integrations.read',
    'integrations.manage',
    'integrations.quickbooks.read',
    'integrations.quickbooks.write'
  ]) AS key
)
SELECT
  r."id" AS role_id,
  r."dealership_id",
  r."key" AS role_key,
  r."name" AS role_name,
  r."is_system",
  p."key" AS permission_key
FROM "Role" r
JOIN "RolePermission" rp ON rp."role_id" = r."id"
JOIN "Permission" p ON p."id" = rp."permission_id"
JOIN obsolete_keys ok ON ok.key = p."key"
WHERE r."is_system" = false
  AND r."deleted_at" IS NULL
ORDER BY r."dealership_id", r."name", p."key";
```

## 4. Pre-Run: User Overrides On Obsolete Permissions

```sql
WITH obsolete_keys AS (
  SELECT unnest(ARRAY[
    'audit.read',
    'inventory.publish.read',
    'platform.admin.read',
    'platform.admin.write',
    'platform.read',
    'platform.write',
    'platform.impersonate',
    'inventory.create',
    'inventory.update',
    'inventory.delete',
    'inventory.export',
    'customers.create',
    'customers.update',
    'customers.delete',
    'customers.export',
    'crm.create',
    'crm.update',
    'crm.delete',
    'crm.export',
    'deals.create',
    'deals.update',
    'deals.delete',
    'deals.export',
    'deals.approve',
    'appointments.read',
    'appointments.create',
    'appointments.update',
    'appointments.cancel',
    'finance.update',
    'finance.approve',
    'bhph.read',
    'bhph.write',
    'integrations.read',
    'integrations.manage',
    'integrations.quickbooks.read',
    'integrations.quickbooks.write'
  ]) AS key
)
SELECT
  upo."user_id",
  upo."enabled",
  upo."created_by_user_id",
  upo."created_at",
  p."key" AS permission_key
FROM "UserPermissionOverride" upo
JOIN "Permission" p ON p."id" = upo."permission_id"
JOIN obsolete_keys ok ON ok.key = p."key"
ORDER BY upo."user_id", p."key";
```

## 5. Pre-Run: Known System And Template Roles Present

This confirms the environment contains role rows that the normalization script can re-sync automatically.

```sql
SELECT
  r."dealership_id",
  r."id" AS role_id,
  r."name",
  r."key",
  r."is_system",
  COUNT(rp."permission_id") AS permission_count
FROM "Role" r
LEFT JOIN "RolePermission" rp ON rp."role_id" = r."id"
WHERE r."deleted_at" IS NULL
  AND (
    (r."is_system" = true AND r."name" IN ('Owner', 'Admin', 'Sales', 'Finance'))
    OR r."key" IN (
      'SALES_ASSOCIATE',
      'SALES_MANAGER',
      'ACCOUNTING',
      'ADMIN_ASSISTANT',
      'INVENTORY_MANAGER',
      'DEALER_ADMIN',
      'OWNER'
    )
  )
GROUP BY r."dealership_id", r."id", r."name", r."key", r."is_system"
ORDER BY r."dealership_id", r."name";
```

## 6. Post-Run: Obsolete Permission Rows Should Be Gone

```sql
WITH obsolete_keys AS (
  SELECT unnest(ARRAY[
    'audit.read',
    'inventory.publish.read',
    'platform.admin.read',
    'platform.admin.write',
    'platform.read',
    'platform.write',
    'platform.impersonate',
    'inventory.create',
    'inventory.update',
    'inventory.delete',
    'inventory.export',
    'customers.create',
    'customers.update',
    'customers.delete',
    'customers.export',
    'crm.create',
    'crm.update',
    'crm.delete',
    'crm.export',
    'deals.create',
    'deals.update',
    'deals.delete',
    'deals.export',
    'deals.approve',
    'appointments.read',
    'appointments.create',
    'appointments.update',
    'appointments.cancel',
    'finance.update',
    'finance.approve',
    'bhph.read',
    'bhph.write',
    'integrations.read',
    'integrations.manage',
    'integrations.quickbooks.read',
    'integrations.quickbooks.write'
  ]) AS key
)
SELECT COUNT(*) AS obsolete_permission_count
FROM "Permission" p
JOIN obsolete_keys ok ON ok.key = p."key";
```

Expected result:
- `0`

## 7. Post-Run: No Custom-Role Obsolete Assignments Should Remain

```sql
WITH obsolete_keys AS (
  SELECT unnest(ARRAY[
    'audit.read',
    'inventory.publish.read',
    'platform.admin.read',
    'platform.admin.write',
    'platform.read',
    'platform.write',
    'platform.impersonate',
    'inventory.create',
    'inventory.update',
    'inventory.delete',
    'inventory.export',
    'customers.create',
    'customers.update',
    'customers.delete',
    'customers.export',
    'crm.create',
    'crm.update',
    'crm.delete',
    'crm.export',
    'deals.create',
    'deals.update',
    'deals.delete',
    'deals.export',
    'deals.approve',
    'appointments.read',
    'appointments.create',
    'appointments.update',
    'appointments.cancel',
    'finance.update',
    'finance.approve',
    'bhph.read',
    'bhph.write',
    'integrations.read',
    'integrations.manage',
    'integrations.quickbooks.read',
    'integrations.quickbooks.write'
  ]) AS key
)
SELECT COUNT(*) AS obsolete_custom_role_assignment_count
FROM "Role" r
JOIN "RolePermission" rp ON rp."role_id" = r."id"
JOIN "Permission" p ON p."id" = rp."permission_id"
JOIN obsolete_keys ok ON ok.key = p."key"
WHERE r."is_system" = false
  AND r."deleted_at" IS NULL;
```

Expected result:
- `0`

## 8. Post-Run: No Obsolete User Overrides Should Remain

```sql
WITH obsolete_keys AS (
  SELECT unnest(ARRAY[
    'audit.read',
    'inventory.publish.read',
    'platform.admin.read',
    'platform.admin.write',
    'platform.read',
    'platform.write',
    'platform.impersonate',
    'inventory.create',
    'inventory.update',
    'inventory.delete',
    'inventory.export',
    'customers.create',
    'customers.update',
    'customers.delete',
    'customers.export',
    'crm.create',
    'crm.update',
    'crm.delete',
    'crm.export',
    'deals.create',
    'deals.update',
    'deals.delete',
    'deals.export',
    'deals.approve',
    'appointments.read',
    'appointments.create',
    'appointments.update',
    'appointments.cancel',
    'finance.update',
    'finance.approve',
    'bhph.read',
    'bhph.write',
    'integrations.read',
    'integrations.manage',
    'integrations.quickbooks.read',
    'integrations.quickbooks.write'
  ]) AS key
)
SELECT COUNT(*) AS obsolete_override_count
FROM "UserPermissionOverride" upo
JOIN "Permission" p ON p."id" = upo."permission_id"
JOIN obsolete_keys ok ON ok.key = p."key";
```

Expected result:
- `0`

## 9. Post-Run: Canonical Permission Count

Current canonical dealer catalog size from [`apps/dealer/lib/constants/permissions.ts`](../../apps/dealer/lib/constants/permissions.ts):
- `42`

```sql
SELECT COUNT(*) AS permission_count
FROM "Permission";
```

Operator interpretation:
- count should match the canonical dealer catalog if the environment is dealer-only and has no extra ad hoc permission rows
- if it does not match, inspect the actual key set before making assumptions

## 10. Post-Run: Inspect Remaining Custom Roles

Use this to review custom roles after obsolete rows have been removed.

```sql
SELECT
  r."dealership_id",
  r."id" AS role_id,
  r."key" AS role_key,
  r."name" AS role_name,
  ARRAY_AGG(p."key" ORDER BY p."key") AS permission_keys
FROM "Role" r
LEFT JOIN "RolePermission" rp ON rp."role_id" = r."id"
LEFT JOIN "Permission" p ON p."id" = rp."permission_id"
WHERE r."is_system" = false
  AND r."deleted_at" IS NULL
GROUP BY r."dealership_id", r."id", r."key", r."name"
ORDER BY r."dealership_id", r."name";
```

Use this result with:
- [`CUSTOM_ROLE_MIGRATION_REVIEW.md`](./CUSTOM_ROLE_MIGRATION_REVIEW.md)
- [`CUSTOM_ROLE_MIGRATION_MATRIX.md`](./CUSTOM_ROLE_MIGRATION_MATRIX.md)

## 11. Post-Run: Inspect User Overrides

```sql
SELECT
  upo."user_id",
  upo."enabled",
  upo."created_by_user_id",
  upo."created_at",
  p."key" AS permission_key
FROM "UserPermissionOverride" upo
JOIN "Permission" p ON p."id" = upo."permission_id"
ORDER BY upo."user_id", p."key";
```

Use this result to identify:
- users who only needed direct alias cleanup
- users whose old override intent may require explicit approval for canonical `*.write`
