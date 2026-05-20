"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getTeamMembers() {
  return prisma.teamMember.findMany({ orderBy: { createdAt: "asc" } });
}

export async function createTeamMember(
  name: string,
  initials: string,
  whatsappNumber?: string
) {
  await prisma.teamMember.create({
    data: {
      name,
      initials,
      whatsappNumber: whatsappNumber || null,
    },
  });
  revalidatePath("/settings/team");
}

export async function updateTeamMember(
  id: string,
  name: string,
  initials: string,
  whatsappNumber: string | undefined,
  isActive: boolean
) {
  await prisma.teamMember.update({
    where: { id },
    data: {
      name,
      initials,
      whatsappNumber: whatsappNumber || null,
      isActive,
    },
  });
  revalidatePath("/settings/team");
}
