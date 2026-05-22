import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { startDate, endDate, clientId, billingType } = await req.json();

  const where: Record<string, unknown> = { deletedAt: null };
  if (startDate || endDate) {
    where.date = {};
    if (startDate) (where.date as Record<string, Date>).gte = new Date(startDate);
    if (endDate) (where.date as Record<string, Date>).lte = new Date(endDate);
  }
  if (clientId) where.project = { clientId };
  if (billingType) {
    where.OR = [
      { billingOverride: billingType },
      { AND: [{ billingOverride: null }, { project: { billingType } }] },
    ];
  }

  const entries = await prisma.taskEntry.findMany({
    where,
    include: {
      project: { include: { client: true } },
      taskHours: { include: { teamMember: true } },
    },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });

  const json = {
    exportDate: format(new Date(), "yyyy-MM-dd"),
    entries: entries.map((e) => ({
      date: format(new Date(e.date), "yyyy-MM-dd"),
      project: e.project?.name ?? null,
      client: e.project?.client?.name ?? null,
      task: e.taskDescription,
      isMeeting: e.isMeeting,
      personCount: e.personCount,
      meetingDuration: e.meetingDuration,
      hours: e.taskHours.map((th) => ({
        member: th.teamMember.name,
        hours: th.hours,
      })),
    })),
  };

  return new NextResponse(JSON.stringify(json, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="chronicle_export_${format(new Date(), "yyyy-MM-dd")}.json"`,
    },
  });
}
