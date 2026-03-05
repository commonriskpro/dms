import { notFound } from "next/navigation";
import { getSessionContextOrNull } from "@/lib/api/handler";
import * as userAdminService from "@/modules/core-platform/service/user-admin";
import * as roleService from "@/modules/core-platform/service/role";
import * as permissionDb from "@/modules/core-platform/db/permission";
import { UserDetailClient } from "./UserDetailClient";

type Props = { params: Promise<{ userId: string }> };

export default async function AdminUserDetailPage({ params }: Props) {
  const session = await getSessionContextOrNull();
  if (!session?.activeDealershipId) {
    notFound();
  }
  const canRead =
    session.permissions.includes("admin.users.read") ||
    session.permissions.includes("admin.memberships.read");
  if (!canRead) {
    notFound();
  }
  const { userId } = await params;
  const [userDetail, rolesResult, permissionsCatalog] = await Promise.all([
    userAdminService.getUserDetail(session.activeDealershipId, userId),
    roleService.listRoles(session.activeDealershipId, {
      limit: 200,
      offset: 0,
      includeSystem: true,
    }),
    permissionDb.listPermissionsCatalog(),
  ]);
  if (!userDetail) {
    notFound();
  }
  const canAssignRoles = session.permissions.includes("admin.roles.assign");
  const canManageOverrides = session.permissions.includes("admin.permissions.manage");
  return (
    <UserDetailClient
      user={userDetail}
      roles={rolesResult.data}
      permissionsCatalog={permissionsCatalog}
      canAssignRoles={canAssignRoles}
      canManageOverrides={canManageOverrides}
    />
  );
}
