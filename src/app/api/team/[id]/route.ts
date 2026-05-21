import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const { name, initials } = body as { name?: string; initials?: string };

  if (!name?.trim() || !initials?.trim()) {
    return NextResponse.json(
      { error: "name and initials are required" },
      { status: 400 }
    );
  }

  const updated = await prisma.teamMember.update({
    where: { id: params.id },
    data: {
      name:     name.trim(),
      initials: initials.trim().toUpperCase(),
    },
  });

  revalidatePath("/settings/team");
  return NextResponse.json(updated);
}
