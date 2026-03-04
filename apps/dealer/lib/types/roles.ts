export interface RoleResponse {
  id: string;
  dealershipId: string;
  name: string;
  isSystem: boolean;
  permissionIds: string[];
  permissions?: { id: string; key: string; description?: string | null; module?: string | null }[];
}

export interface RolesListResponse {
  data: RoleResponse[];
  meta: { total: number; limit: number; offset: number };
}

export interface PermissionResponse {
  id: string;
  key: string;
  description?: string | null;
  module?: string | null;
}

export interface PermissionsListResponse {
  data: PermissionResponse[];
  meta: { total: number; limit: number; offset: number };
}
