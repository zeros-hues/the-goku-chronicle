import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppMessage, downloadWhatsAppMedia } from "@/lib/whatsapp";
import { extractTimesheetFromImage, ExtractedEntry } from "@/lib/ai-provider";
import { BillingType, EntrySource } from "@prisma/client";
import { format } from "date-fns";

// In-memory state (resets on cold start — acceptable per spec)
type PendingState = {
  entries: ExtractedEntry[];
  date: string;
  unknownProjects: number[];
};

const pendingConfirmations = new Map<string, PendingState>();
const pendingRegistration = new Map<string, boolean>();

// GET — webhook verification
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// POST — incoming messages
export async function POST(req: NextRequest) {
  const body = await req.json();

  // Return 200 immediately, process async
  setImmediate(() => handleMessage(body).catch(console.error));

  return NextResponse.json({ status: "ok" });
}

async function formatConfirmation(state: PendingState): Promise<string> {
  const lines: string[] = [`📋 Timesheet for ${format(new Date(state.date), "dd MMM yyyy")}`, ""];

  for (const entry of state.entries) {
    const isUnknown = state.unknownProjects.includes(entry.rowNumber);
    if (entry.isMeeting) {
      lines.push(`${entry.rowNumber}. ${entry.taskDescription}`);
      lines.push(`   Meeting | ${entry.personCount} persons | ${entry.hours} hrs`);
    } else {
      lines.push(`${entry.rowNumber}. ${entry.taskDescription}`);
      lines.push(
        `   Project: ${entry.projectCategory ?? "Internal"} | ${entry.designer ?? "—"}: ${entry.hours} hrs`
      );
    }
    if (isUnknown) {
      lines.push(`   ⚠️ Project "${entry.projectCategory}" not found in your list.`);
    }
    lines.push("");
  }

  if (state.unknownProjects.length > 0) {
    lines.push(`Reply with a project name to update, CREATE to add it, or SKIP to mark as internal.`);
    lines.push("");
  }

  lines.push("Reply:");
  lines.push("✅ YES to save all");
  lines.push("✏️ EDIT [row] [field] [value]");
  lines.push("❌ NO to cancel");

  return lines.join("\n");
}

async function handleMessage(body: Record<string, unknown>) {
  const entry = (body as { entry?: unknown[] }).entry?.[0];
  if (!entry) return;

  const change = (entry as { changes?: unknown[] }).changes?.[0];
  if (!change) return;

  const value = (change as { value?: unknown }).value as Record<string, unknown>;
  if (!value?.messages) return;

  const message = (value.messages as unknown[])[0] as Record<string, unknown>;
  const from = message.from as string;
  const msgType = message.type as string;

  const member = await prisma.teamMember.findUnique({
    where: { whatsappNumber: from },
  });

  if (!member) {
    if (pendingRegistration.get(from)) return;
    pendingRegistration.set(from, true);
    await sendWhatsAppMessage(from, "Hi! I don't recognise this number. What's your name?");
    return;
  }

  const text = msgType === "text"
    ? ((message.text as { body: string }).body ?? "").trim()
    : "";

  const upperText = text.toUpperCase();
  const pending = pendingConfirmations.get(from);

  // Handle image
  if (msgType === "image") {
    await sendWhatsAppMessage(from, "Got it, reading your timesheet...");

    try {
      const image = message.image as { id: string; mime_type: string };
      const { data: base64, mimeType } = await downloadWhatsAppMedia(image.id);
      const extracted = await extractTimesheetFromImage(base64, mimeType);

      // Check for unknown projects
      const allProjects = await prisma.project.findMany({ select: { name: true } });
      const projectNames = new Set(allProjects.map((p) => p.name.toLowerCase()));

      const unknownProjects: number[] = [];
      for (const e of extracted.entries) {
        if (e.projectCategory && !projectNames.has(e.projectCategory.toLowerCase())) {
          unknownProjects.push(e.rowNumber);
        }
      }

      const state: PendingState = {
        entries: extracted.entries,
        date: extracted.date,
        unknownProjects,
      };
      pendingConfirmations.set(from, state);

      const confirmation = await formatConfirmation(state);
      await sendWhatsAppMessage(from, confirmation);
    } catch (err) {
      console.error("AI extraction failed:", err);
      await sendWhatsAppMessage(from, "Sorry, I couldn't read that timesheet. Please try again.");
    }
    return;
  }

  // YES — save
  if (upperText === "YES" && pending) {
    let saved = 0;
    for (const e of pending.entries) {
      const project = e.projectCategory
        ? await prisma.project.findFirst({
            where: { name: { equals: e.projectCategory, mode: "insensitive" } },
          })
        : null;

      const taskEntry = await prisma.taskEntry.create({
        data: {
          date: new Date(pending.date),
          projectId: project?.id ?? null,
          taskDescription: e.taskDescription,
          isMeeting: e.isMeeting,
          personCount: e.personCount,
          meetingDuration: e.isMeeting ? e.hours : null,
          source: EntrySource.WHATSAPP_BOT,
          submittedByPhone: from,
        },
      });

      if (!e.isMeeting && member) {
        await prisma.taskHour.create({
          data: {
            taskEntryId: taskEntry.id,
            teamMemberId: member.id,
            hours: e.hours,
          },
        });
      }
      saved++;
    }

    pendingConfirmations.delete(from);
    await sendWhatsAppMessage(
      from,
      `✅ Saved! ${saved} tasks logged for ${format(new Date(pending.date), "dd MMM yyyy")}.`
    );
    return;
  }

  // NO — cancel
  if (upperText === "NO" && pending) {
    pendingConfirmations.delete(from);
    await sendWhatsAppMessage(from, "Cancelled. Nothing was saved.");
    return;
  }

  // EDIT [row] [field] [value]
  if (upperText.startsWith("EDIT ") && pending) {
    const parts = text.split(" ");
    const row = parseInt(parts[1]);
    const field = parts[2]?.toLowerCase();
    const value = parts.slice(3).join(" ");

    const entryIdx = pending.entries.findIndex((e) => e.rowNumber === row);
    if (entryIdx >= 0 && field && value) {
      if (field === "hours") pending.entries[entryIdx].hours = parseFloat(value);
      else if (field === "project") pending.entries[entryIdx].projectCategory = value;
      else if (field === "task") pending.entries[entryIdx].taskDescription = value;

      const confirmation = await formatConfirmation(pending);
      await sendWhatsAppMessage(from, confirmation);
    }
    return;
  }

  // CREATE — for unknown project
  if (upperText === "CREATE" && pending && pending.unknownProjects.length > 0) {
    const rowNum = pending.unknownProjects[0];
    const entry = pending.entries.find((e) => e.rowNumber === rowNum);
    if (entry?.projectCategory) {
      let unknownClient = await prisma.client.findFirst({ where: { name: "Unknown" } });
      if (!unknownClient) {
        unknownClient = await prisma.client.create({
          data: { name: "Unknown", hasRetainership: false },
        });
      }
      await prisma.project.create({
        data: {
          name: entry.projectCategory,
          clientId: unknownClient.id,
          billingType: BillingType.INTERNAL,
        },
      });
      pending.unknownProjects.shift();
      const confirmation = await formatConfirmation(pending);
      await sendWhatsAppMessage(from, confirmation);
    }
    return;
  }

  // SKIP — for unknown project
  if (upperText === "SKIP" && pending && pending.unknownProjects.length > 0) {
    const rowNum = pending.unknownProjects.shift()!;
    const entryIdx = pending.entries.findIndex((e) => e.rowNumber === rowNum);
    if (entryIdx >= 0) {
      pending.entries[entryIdx].projectCategory = null;
      pending.entries[entryIdx].isInternal = true;
    }
    const confirmation = await formatConfirmation(pending);
    await sendWhatsAppMessage(from, confirmation);
    return;
  }

  // Unknown project name reply
  if (pending && pending.unknownProjects.length > 0 && text) {
    const rowNum = pending.unknownProjects[0];
    const entryIdx = pending.entries.findIndex((e) => e.rowNumber === rowNum);
    if (entryIdx >= 0) {
      pending.entries[entryIdx].projectCategory = text;
      const existing = await prisma.project.findFirst({
        where: { name: { equals: text, mode: "insensitive" } },
      });
      if (existing) {
        pending.unknownProjects.shift();
      }
      const confirmation = await formatConfirmation(pending);
      await sendWhatsAppMessage(from, confirmation);
    }
  }
}
