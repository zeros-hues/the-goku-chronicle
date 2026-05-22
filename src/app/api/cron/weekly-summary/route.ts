import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { startOfWeek, endOfWeek, subWeeks, format } from "date-fns";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Last week (Mon–Sun)
  const lastWeekStart = startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 });
  const lastWeekEnd   = endOfWeek(subWeeks(new Date(), 1),   { weekStartsOn: 1 });

  const entries = await prisma.taskEntry.findMany({
    where: { date: { gte: lastWeekStart, lte: lastWeekEnd }, deletedAt: null },
    include: {
      project: true,
      taskHours: { include: { teamMember: true } },
    },
  });

  // Total hours
  const totalHours = entries.reduce((sum, e) => {
    if (e.isMeeting) return sum + (e.meetingDuration ?? 0);
    return sum + e.taskHours.reduce((s, th) => s + th.hours, 0);
  }, 0);

  // Per-member hours
  const memberMap: Record<string, { name: string; hours: number }> = {};
  for (const e of entries) {
    for (const th of e.taskHours) {
      if (!memberMap[th.teamMemberId]) memberMap[th.teamMemberId] = { name: th.teamMember.name, hours: 0 };
      memberMap[th.teamMemberId].hours += th.hours;
    }
  }
  const memberList = Object.values(memberMap).sort((a, b) => b.hours - a.hours);

  // Top 3 projects
  const projectMap: Record<string, { name: string; hours: number }> = {};
  for (const e of entries) {
    const key = e.projectId ?? "internal";
    const name = e.project?.name ?? "Internal";
    if (!projectMap[key]) projectMap[key] = { name, hours: 0 };
    if (e.isMeeting) projectMap[key].hours += e.meetingDuration ?? 0;
    else projectMap[key].hours += e.taskHours.reduce((s, th) => s + th.hours, 0);
  }
  const topProjects = Object.values(projectMap).sort((a, b) => b.hours - a.hours).slice(0, 3);

  const weekLabel = `${format(lastWeekStart, "d MMM")} – ${format(lastWeekEnd, "d MMM yyyy")}`;

  const message = [
    `📊 *Weekly Summary — ${weekLabel}*`,
    ``,
    `*Total studio hours:* ${totalHours}h`,
    ``,
    `*Team breakdown:*`,
    ...memberList.map(m => `  • ${m.name}: ${m.hours}h`),
    ``,
    `*Top projects:*`,
    ...topProjects.map((p, i) => `  ${i + 1}. ${p.name} — ${p.hours}h`),
    ``,
    `Have a great week! 🚀`,
  ].join("\n");

  // Send to all active members with WhatsApp numbers
  const recipients = await prisma.teamMember.findMany({
    where: { isActive: true, whatsappNumber: { not: null } },
  });

  let sent = 0;
  const errors: string[] = [];
  for (const r of recipients) {
    if (!r.whatsappNumber) continue;
    try {
      await sendWhatsAppMessage(r.whatsappNumber, message);
      sent++;
    } catch (err) {
      errors.push(`${r.name}: ${String(err)}`);
    }
  }

  return NextResponse.json({ sent, errors });
}
