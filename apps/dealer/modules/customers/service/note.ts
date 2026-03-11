import * as customersDb from "../db/customers";
import * as notesDb from "../db/notes";
import * as activityDb from "../db/activity";
import { auditLog } from "@/lib/audit";
import { ApiError } from "@/lib/auth";
import { requireTenantActiveForRead, requireTenantActiveForWrite } from "@/lib/tenant-status";

export type NoteListOptions = { limit: number; offset: number };

export async function listNotes(dealershipId: string, customerId: string, options: NoteListOptions) {
  await requireTenantActiveForRead(dealershipId);
  const customer = await customersDb.getCustomerById(dealershipId, customerId);
  if (!customer) throw new ApiError("NOT_FOUND", "Customer not found");
  return notesDb.listNotes(dealershipId, customerId, options);
}

export async function createNote(
  dealershipId: string,
  userId: string,
  customerId: string,
  data: { body: string },
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const customer = await customersDb.getCustomerById(dealershipId, customerId);
  if (!customer) throw new ApiError("NOT_FOUND", "Customer not found");
  const created = await notesDb.createNote(dealershipId, customerId, data, userId);
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "customer.note.created",
    entity: "CustomerNote",
    entityId: created.id,
    metadata: { customerId, noteId: created.id },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  await activityDb.appendActivity(
    dealershipId,
    customerId,
    "note_added",
    "Note",
    created.id,
    null,
    userId
  );
  return created;
}

export async function updateNote(
  dealershipId: string,
  userId: string,
  customerId: string,
  noteId: string,
  data: { body?: string },
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const customer = await customersDb.getCustomerById(dealershipId, customerId);
  if (!customer) throw new ApiError("NOT_FOUND", "Customer not found");
  const updated = await notesDb.updateNote(dealershipId, customerId, noteId, data);
  if (!updated) throw new ApiError("NOT_FOUND", "Note not found");
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "customer.note.updated",
    entity: "CustomerNote",
    entityId: noteId,
    metadata: { customerId, noteId },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return updated;
}

export async function softDeleteNote(
  dealershipId: string,
  userId: string,
  customerId: string,
  noteId: string,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const customer = await customersDb.getCustomerById(dealershipId, customerId);
  if (!customer) throw new ApiError("NOT_FOUND", "Customer not found");
  const existing = await notesDb.softDeleteNote(dealershipId, customerId, noteId, userId);
  if (!existing) throw new ApiError("NOT_FOUND", "Note not found");
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "customer.note.deleted",
    entity: "CustomerNote",
    entityId: noteId,
    metadata: { customerId, noteId },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return existing;
}
