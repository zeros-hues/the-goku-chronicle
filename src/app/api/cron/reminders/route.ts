import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const currentHour = `${now.getHours().toString().padStart(2, "0")}:00`;
  const todayStart = new Date(now.toISOString().substring(0, 10));
  const todayEnd   = new Date(todayStart.getTime() + 86400000);

  // Check if any user has reminder enabled for this hour
  const usersWithReminder = await prisma.user.findMany({
    where: { reminderEnabled: true, reminderTime: currentHour },
  });
  if (usersWithReminder.length === 0) {
    return NextResponse.json({ sent: 0, reason: "No users with reminder at this hour" });
  }

  // Check if any entries were logged today
  const todayEntryCount = await prisma.taskEntry.count({
    where: { date: { gte: todayStart, lt: todayEnd }, deletedAt: null },
  });
  if (todayEntryCount > 0) {
    return NextResponse.json({ sent: 0, reason: "Entries already logged today" });
  }

  // Send reminder to all active team members with WhatsApp enabled
  const members = await prisma.teamMember.findMany({
    where: { isActive: true, reminderEnabled: true, whatsappNumber: { not: null } },
  });

  let sent = 0;
  const errors: string[] = [];
  for (const member of members) {
    if (!member.whatsappNumber) continue;
    try {
      await sendWhatsAppMessage(
        member.whatsappNumber,
        `👋 Hey ${member.name.split(" ")[0]}! You haven't logged any tasks today. Don't forget to record your work in Chronicle!`
      );
      sent++;
    } catch (err) {
      errors.push(`${member.name}: ${String(err)}`);
    }
  }

  return NextResponse.json({ sent, errors });
}
