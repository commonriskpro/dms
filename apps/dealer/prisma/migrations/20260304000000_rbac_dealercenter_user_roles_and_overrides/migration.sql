-- Add optional template key to Role (unique per dealership)
ALTER TABLE "Role" ADD COLUMN IF NOT EXISTS "key" VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS "Role_dealershipId_key_key" ON "Role"("dealership_id", "key");

-- Multi-role union: user_roles (user_id, role_id)
CREATE TABLE IF NOT EXISTS "UserRole" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("user_id","role_id")
);

ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "UserRole_role_id_idx" ON "UserRole"("role_id");

-- Per-user permission overrides (grant or revoke)
CREATE TABLE IF NOT EXISTS "UserPermissionOverride" (
    "user_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserPermissionOverride_pkey" PRIMARY KEY ("user_id","permission_id")
);

ALTER TABLE "UserPermissionOverride" ADD CONSTRAINT "UserPermissionOverride_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserPermissionOverride" ADD CONSTRAINT "UserPermissionOverride_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserPermissionOverride" ADD CONSTRAINT "UserPermissionOverride_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "UserPermissionOverride_permission_id_idx" ON "UserPermissionOverride"("permission_id");
