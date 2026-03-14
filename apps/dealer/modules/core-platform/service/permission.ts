import * as permissionDb from "../db/permission";

export async function listPermissionsCatalog() {
  return permissionDb.listPermissionsCatalog();
}

export async function listPermissionsPaginated(
  where?: { module?: string },
  options: { limit: number; offset: number } = { limit: 100, offset: 0 }
) {
  return permissionDb.listPermissionsPaginated(where, options);
}
