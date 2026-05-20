"use server";

import { prisma } from "@/lib/prisma";
import { BillingType } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function getClientsWithProjects() {
  return prisma.client.findMany({
    include: {
      projects: {
        orderBy: { name: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function createClient(name: string, hasRetainership: boolean) {
  await prisma.client.create({ data: { name, hasRetainership } });
  revalidatePath("/settings/projects");
}

export async function updateClient(
  id: string,
  name: string,
  hasRetainership: boolean
) {
  await prisma.client.update({ where: { id }, data: { name, hasRetainership } });
  revalidatePath("/settings/projects");
}

export async function createProject(
  name: string,
  clientId: string,
  billingType: BillingType
) {
  await prisma.project.create({ data: { name, clientId, billingType } });
  revalidatePath("/settings/projects");
}

export async function updateProject(
  id: string,
  name: string,
  billingType: BillingType
) {
  await prisma.project.update({ where: { id }, data: { name, billingType } });
  revalidatePath("/settings/projects");
}

export async function archiveProject(id: string) {
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) return;

  await prisma.project.update({
    where: { id },
    data: { archivedAt: project.archivedAt ? null : new Date() },
  });
  revalidatePath("/settings/projects");
}
