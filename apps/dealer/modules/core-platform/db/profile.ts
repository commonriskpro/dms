import { prisma } from "@/lib/db";

export async function getProfileByEmail(email: string) {
  return prisma.profile.findUnique({ where: { email } });
}
