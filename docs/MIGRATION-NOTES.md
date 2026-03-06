# Migration notes (core-platform)

## Partial unique constraints

Postgres supports partial unique indexes; Prisma schema does not define them. The migration `20250228000000_core_platform_init` adds the following **manually** in SQL:

1. **Membership** — One active membership per (dealershipId, userId):
   - `CREATE UNIQUE INDEX "Membership_dealership_id_user_id_active_key" ON "Membership"("dealership_id", "user_id") WHERE "disabled_at" IS NULL;`
   - Ensures a user cannot have two active memberships in the same dealership. App layer must also enforce this when creating memberships (check for existing active membership before insert).

2. **Role** — One active role name per dealership (soft-deleted roles excluded):
   - `CREATE UNIQUE INDEX "Role_dealership_id_name_active_key" ON "Role"("dealership_id", "name") WHERE "deleted_at" IS NULL;`
   - Ensures no duplicate role names per dealership for non-deleted roles. App layer should not allow creating a role with a name that already exists (active).

If you run `prisma migrate dev` and Prisma generates a new migration from the schema, it will not include these partial indexes (Prisma does not support partial uniques in the schema). To keep them, either:

- Keep using the hand-written migration above as the initial migration, or
- Add a follow-up migration that only contains the two `CREATE UNIQUE INDEX ... WHERE` statements.

## App-level enforcement

- Before creating a **Membership**, the service layer checks that no active membership exists for (userId, dealershipId). If one exists, return existing or CONFLICT.
- Before creating a **Role**, the service layer checks that no active role with the same name exists for the dealership. If it does, return VALIDATION_ERROR or CONFLICT.
