import { prisma } from "@/lib/db";

export async function getProfileById(id: string) {
  return prisma.profile.findUnique({ where: { id } });
}

export async function getProfileByEmail(email: string) {
  return prisma.profile.findUnique({ where: { email } });
}
