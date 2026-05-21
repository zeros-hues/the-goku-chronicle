import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const year = new Date().getFullYear();
  const start = new Date(`${year}-01-01T00:00:00.000Z`);
  const end = new Date(`${year}-12-31T23:59:59.999Z`);

  const entries = await prisma.taskEntry.findMany({
    where: {
      deletedAt: null,
      date: { gte: start, lte: end },
    },
    select: {
      date: true,
      isMeeting: true,
      meetingDuration: true,
      taskHours: { select: { hours: true } },
    },
  });

  // Aggregate hours per date string "yyyy-MM-dd"
  const byDate: Record<string, number> = {};

  for (const entry of entries) {
    const d = entry.date;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const hours = entry.isMeeting
      ? (entry.meetingDuration ?? 0)
      : entry.taskHours.reduce((s, th) => s + th.hours, 0);
    byDate[key] = (byDate[key] ?? 0) + hours;
  }

  return NextResponse.json({ year, days: byDate });
}
