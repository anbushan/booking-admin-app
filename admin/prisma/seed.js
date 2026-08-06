import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const admins = [
    { id: "seed-super-admin-1", email: "anbushanthi001@gmail.com", password: "changeme", role: "super_admin" },
  ];

  for (const a of admins) {
    const passwordHash = await bcrypt.hash(a.password, 10);

    const admin = await prisma.adminUser.upsert({
      where: { email: a.email },
      update: { passwordHash },
      create: { email: a.email, passwordHash },
    });

    await prisma.adminRole.upsert({
      where: { id: `${a.id}-role` },
      update: { role: a.role },
      create: { id: `${a.id}-role`, adminId: admin.id, role: a.role },
    });

    console.log(`Seeded admin login: ${a.email} / ${a.password} (${a.role}) — change this password after first login.`);
  }
}

main().finally(() => prisma.$disconnect());
