import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";
import { format } from "date-fns";

function entryHours(entry: {
  isMeeting: boolean;
  meetingDuration: number | null;
  taskHours: Array<{ hours: number }>;
}): number {
  if (entry.isMeeting) return entry.meetingDuration ?? 0;
  return entry.taskHours.reduce((s, th) => s + th.hours, 0);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { startDate, endDate, clientId, billingType, anonymous } = await req.json();

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

  const activeMembers = await prisma.teamMember.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Timesheet");

  // Header style
  const headerFill: ExcelJS.FillPattern = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E293B" },
  };
  const headerFont = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };

  const baseColumns = ["Date", "Day", "Project", "Task"];
  const memberColumns = anonymous
    ? ["No. of Resources", "Working Hours"]
    : activeMembers.map((m) => m.initials);
  const allColumns = [...baseColumns, ...memberColumns, "Total Hours"];

  sheet.columns = allColumns.map((h) => ({
    header: h,
    width: h === "Task" ? 40 : h === "Project" ? 20 : 15,
  }));

  // Style header row
  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FF4F6BED" } },
    };
  });
  headerRow.height = 28;

  // Group by date
  const grouped: Record<string, typeof entries> = {};
  entries.forEach((e) => {
    const key = format(new Date(e.date), "yyyy-MM-dd");
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(e);
  });

  let rowIndex = 2;
  let grandTotal = 0;

  const sortedDates = Object.keys(grouped).sort();

  for (const dateKey of sortedDates) {
    const dayEntries = grouped[dateKey];
    const dateStartRow = rowIndex;
    const date = new Date(dateKey + "T00:00:00");
    const dateLabel = format(date, "dd MMM");
    const dayLabel = format(date, "EEE");
    let dayTotal = 0;

    for (const entry of dayEntries) {
      const total = entryHours(entry);
      dayTotal += total;
      grandTotal += total;

      const rowData: (string | number)[] = [dateLabel, dayLabel, entry.project?.name ?? "Internal", entry.taskDescription];

      if (anonymous) {
        if (entry.isMeeting) {
          rowData.push(entry.personCount ?? 0, entry.meetingDuration ?? 0);
        } else {
          const hoursArr = entry.taskHours.map((th) => th.hours);
          rowData.push(hoursArr.length, hoursArr.length === 1 ? hoursArr[0] : hoursArr.join("+"));
        }
      } else {
        for (const m of activeMembers) {
          const th = entry.taskHours.find((h) => h.teamMemberId === m.id);
          rowData.push(th ? th.hours : "");
        }
      }

      rowData.push(total);

      const row = sheet.addRow(rowData);
      row.height = 20;
      row.getCell(1).alignment = { horizontal: "center" };
      row.getCell(2).alignment = { horizontal: "center" };
      rowIndex++;
    }

    // Date cell merge
    if (dayEntries.length > 1) {
      sheet.mergeCells(dateStartRow, 1, rowIndex - 1, 1);
      sheet.mergeCells(dateStartRow, 2, rowIndex - 1, 2);
    }

    // Total row for the day
    const totalRow = sheet.addRow([
      "",
      "",
      "",
      "Daily Total",
      ...new Array(memberColumns.length).fill(""),
      dayTotal,
    ]);
    totalRow.font = { bold: true };
    totalRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF8FAFC" },
    };
    rowIndex++;
  }

  // Grand total row
  const grandTotalRow = sheet.addRow([
    "",
    "",
    "",
    "Grand Total",
    ...new Array(memberColumns.length).fill(""),
    grandTotal,
  ]);
  grandTotalRow.font = { bold: true, size: 12 };
  grandTotalRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF4F6BED" },
  };
  grandTotalRow.eachCell((cell) => {
    cell.font = { ...grandTotalRow.font, color: { argb: "FFFFFFFF" } };
  });

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="timesheet.xlsx"`,
    },
  });
}
