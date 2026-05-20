import { PrismaClient, BillingType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Users
  const hashedPassword = await bcrypt.hash("goku2026", 10);
  await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: { username: "admin", password: hashedPassword },
  });

  // Clients
  const appasamy = await prisma.client.upsert({
    where: { name: "Appasamy" },
    update: {},
    create: { name: "Appasamy", hasRetainership: true },
  });

  const gokuStudio = await prisma.client.upsert({
    where: { name: "Goku Studio" },
    update: {},
    create: { name: "Goku Studio", hasRetainership: false },
  });

  // Projects — Appasamy
  const appasamyProjects: [string, BillingType][] = [
    ["Autoref", BillingType.RETAINERSHIP],
    ["Perimeter", BillingType.RETAINERSHIP],
    ["Phaco", BillingType.RETAINERSHIP],
    ["Dynalase", BillingType.RETAINERSHIP],
    ["3D Microscope", BillingType.RETAINERSHIP],
    ["Oculume", BillingType.OUT_OF_RETAINERSHIP],
    ["Digimap", BillingType.OUT_OF_RETAINERSHIP],
  ];

  for (const [name, billingType] of appasamyProjects) {
    await prisma.project.upsert({
      where: { name_clientId: { name, clientId: appasamy.id } },
      update: {},
      create: { name, clientId: appasamy.id, billingType },
    });
  }

  // Projects — Goku Studio
  await prisma.project.upsert({
    where: { name_clientId: { name: "Website", clientId: gokuStudio.id } },
    update: {},
    create: {
      name: "Website",
      clientId: gokuStudio.id,
      billingType: BillingType.INTERNAL,
    },
  });

  // Team Members
  const members = [
    { name: "Gokulakannan", initials: "G" },
    { name: "Pradeep", initials: "Pd" },
    { name: "Dinesh K", initials: "DK" },
    { name: "Mohammed Ali", initials: "MA" },
    { name: "Siddharth", initials: "Sid" },
    { name: "Praveen", initials: "Pr" },
  ];

  for (const member of members) {
    const existing = await prisma.teamMember.findFirst({
      where: { name: member.name },
    });
    if (!existing) {
      await prisma.teamMember.create({ data: member });
    }
  }

  console.log("Seed complete.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
