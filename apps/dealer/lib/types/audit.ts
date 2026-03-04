export interface AuditLogResponse {
  id: string;
  dealershipId: string;
  actorId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  metadata: unknown;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface AuditListResponse {
  data: AuditLogResponse[];
  meta: { total: number; limit: number; offset: number };
}
