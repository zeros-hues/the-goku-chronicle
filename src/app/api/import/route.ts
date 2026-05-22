import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type ParsedImportEntry = {
  date: string; // yyyy-MM-dd
  projectName: string | null;
  clientName: string | null;
  taskDescription: string;
  isMeeting: boolean;
  personCount?: number;
  meetingDuration?: number;
  hours: Array<{ memberName: string; hours: number }>;
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { entries, skipDuplicates } = (await req.json()) as {
    entries: ParsedImportEntry[];
    skipDuplicates: boolean;
  };

  const projects = await prisma.project.findMany({
    include: { client: true },
  });
  const members = await prisma.teamMember.findMany({ where: { isActive: true } });

  const existingEntries = await prisma.taskEntry.findMany({
    where: { deletedAt: null },
    select: { date: true, projectId: true, taskDescription: true },
  });
  const existingSet = new Set(
    existingEntries.map(
      (e) => `${e.date.toISOString().substring(0, 10)}|${e.projectId ?? ""}|${e.taskDescription.toLowerCase()}`
    )
  );

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const entry of entries) {
    try {
      // Resolve project
      let projectId: string | null = null;
      if (entry.projectName) {
        const match = projects.find(
          (p) =>
            p.name.toLowerCase() === entry.projectName!.toLowerCase() ||
            (entry.clientName && p.client.name.toLowerCase() === entry.clientName.toLowerCase() && p.name.toLowerCase() === entry.projectName!.toLowerCase())
        );
        if (!match) {
          errors.push(`Unknown project: "${entry.projectName}"`);
          continue;
        }
        projectId = match.id;
      }

      // Duplicate check
      const dupKey = `${entry.date}|${projectId ?? ""}|${entry.taskDescription.toLowerCase()}`;
      if (skipDuplicates && existingSet.has(dupKey)) {
        skipped++;
        continue;
      }

      // Resolve member hours
      const taskHours: Array<{ teamMemberId: string; hours: number }> = [];
      for (const h of entry.hours) {
        const member = members.find(
          (m) => m.name.toLowerCase() === h.memberName.toLowerCase() || m.initials.toLowerCase() === h.memberName.toLowerCase()
        );
        if (member) {
          taskHours.push({ teamMemberId: member.id, hours: h.hours });
        }
      }

      await prisma.taskEntry.create({
        data: {
          date: new Date(entry.date),
          projectId,
          taskDescription: entry.taskDescription,
          isMeeting: entry.isMeeting,
          personCount: entry.personCount ?? null,
          meetingDuration: entry.meetingDuration ?? null,
          taskHours: { createMany: { data: taskHours } },
        },
      });

      existingSet.add(dupKey);
      imported++;
    } catch (err) {
      errors.push(`Failed to import entry: ${entry.taskDescription} — ${String(err)}`);
    }
  }

  return NextResponse.json({ imported, skipped, errors });
}
