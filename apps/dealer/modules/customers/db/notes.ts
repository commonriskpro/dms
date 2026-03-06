import { prisma } from "@/lib/db";

export type NoteListOptions = {
  limit: number;
  offset: number;
};

export async function listNotes(dealershipId: string, customerId: string, options: NoteListOptions) {
  const { limit, offset } = options;
  const where = {
    dealershipId,
    customerId,
    deletedAt: null,
  };
  const [data, total] = await Promise.all([
    prisma.customerNote.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        createdByProfile: { select: { id: true, fullName: true, email: true } },
      },
    }),
    prisma.customerNote.count({ where }),
  ]);
  return { data, total };
}

export async function getNoteById(
  dealershipId: string,
  customerId: string,
  noteId: string
) {
  return prisma.customerNote.findFirst({
    where: { id: noteId, dealershipId, customerId, deletedAt: null },
    include: {
      createdByProfile: { select: { id: true, fullName: true, email: true } },
    },
  });
}

export async function createNote(
  dealershipId: string,
  customerId: string,
  data: { body: string },
  createdBy: string
) {
  return prisma.customerNote.create({
    data: {
      dealershipId,
      customerId,
      body: data.body,
      createdBy,
    },
    include: {
      createdByProfile: { select: { id: true, fullName: true, email: true } },
    },
  });
}

export async function updateNote(
  dealershipId: string,
  customerId: string,
  noteId: string,
  data: { body?: string }
) {
  const existing = await prisma.customerNote.findFirst({
    where: { id: noteId, dealershipId, customerId, deletedAt: null },
  });
  if (!existing) return null;
  if (data.body !== undefined) {
    await prisma.customerNote.update({
      where: { id: noteId },
      data: { body: data.body },
    });
  }
  return getNoteById(dealershipId, customerId, noteId);
}

export async function softDeleteNote(
  dealershipId: string,
  customerId: string,
  noteId: string,
  deletedBy: string
) {
  const existing = await prisma.customerNote.findFirst({
    where: { id: noteId, dealershipId, customerId, deletedAt: null },
  });
  if (!existing) return null;
  await prisma.customerNote.update({
    where: { id: noteId },
    data: { deletedAt: new Date(), deletedBy },
  });
  return existing;
}

/** Count notes created today (start of day UTC). For dashboard team activity. */
export async function countNotesCreatedToday(dealershipId: string): Promise<number> {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  return prisma.customerNote.count({
    where: { dealershipId, deletedAt: null, createdAt: { gte: start } },
  });
}
