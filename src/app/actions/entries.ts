"use server";

import { prisma } from "@/lib/prisma";
import { BillingType, EntrySource } from "@prisma/client";
import { revalidatePath } from "next/cache";

export type CreateEntryInput = {
  date: string;
  projectId: string | null;
  taskDescription: string;
  isMeeting: boolean;
  personCount?: number;
  meetingDuration?: number;
  billingOverride?: BillingType | null;
  source?: EntrySource;
  submittedByPhone?: string;
  taskHours?: Array<{ teamMemberId: string; hours: number }>;
};

export async function createEntry(input: CreateEntryInput) {
  const { taskHours, ...rest } = input;
  const entry = await prisma.taskEntry.create({
    data: {
      ...rest,
      date: new Date(input.date),
      source: input.source ?? EntrySource.MANUAL,
    },
  });

  if (taskHours && taskHours.length > 0) {
    await prisma.taskHour.createMany({
      data: taskHours.map((th) => ({
        taskEntryId: entry.id,
        teamMemberId: th.teamMemberId,
        hours: th.hours,
      })),
    });
  }

  revalidatePath("/timesheet");
  return entry;
}

export async function updateEntry(id: string, input: CreateEntryInput) {
  const { taskHours, ...rest } = input;

  await prisma.taskEntry.update({
    where: { id },
    data: {
      ...rest,
      date: new Date(input.date),
    },
  });

  if (taskHours !== undefined) {
    await prisma.taskHour.deleteMany({ where: { taskEntryId: id } });
    if (taskHours.length > 0) {
      await prisma.taskHour.createMany({
        data: taskHours.map((th) => ({
          taskEntryId: id,
          teamMemberId: th.teamMemberId,
          hours: th.hours,
        })),
      });
    }
  }

  revalidatePath("/timesheet");
}

export async function softDeleteEntry(id: string) {
  await prisma.taskEntry.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  revalidatePath("/timesheet");
}

export async function restoreEntry(id: string) {
  await prisma.taskEntry.update({
    where: { id },
    data: { deletedAt: null },
  });
  revalidatePath("/trash");
  revalidatePath("/timesheet");
}

export async function permanentlyDeleteEntry(id: string) {
  await prisma.taskHour.deleteMany({ where: { taskEntryId: id } });
  await prisma.taskEntry.delete({ where: { id } });
  revalidatePath("/trash");
}

export async function getEntries(filters?: {
  startDate?: string;
  endDate?: string;
  clientId?: string;
  billingType?: BillingType;
  teamMemberId?: string;
}) {
  const where: Record<string, unknown> = { deletedAt: null };

  if (filters?.startDate || filters?.endDate) {
    where.date = {};
    if (filters.startDate)
      (where.date as Record<string, Date>).gte = new Date(filters.startDate);
    if (filters.endDate)
      (where.date as Record<string, Date>).lte = new Date(filters.endDate);
  }

  if (filters?.clientId) {
    where.project = { clientId: filters.clientId };
  }

  if (filters?.billingType) {
    where.OR = [
      { billingOverride: filters.billingType },
      {
        AND: [
          { billingOverride: null },
          { project: { billingType: filters.billingType } },
        ],
      },
    ];
  }

  if (filters?.teamMemberId) {
    where.taskHours = { some: { teamMemberId: filters.teamMemberId } };
  }

  return prisma.taskEntry.findMany({
    where,
    include: {
      project: { include: { client: true } },
      taskHours: { include: { teamMember: true } },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
}

export async function getTrashedEntries() {
  return prisma.taskEntry.findMany({
    where: { deletedAt: { not: null } },
    include: {
      project: { include: { client: true } },
      taskHours: { include: { teamMember: true } },
    },
    orderBy: { deletedAt: "desc" },
  });
}
