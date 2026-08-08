import { PrismaClient } from "@prisma/client";

// Next.js dev mode hot-reloads this module on every file save without
// restarting the process — a plain `new PrismaClient()` here would mint
// a fresh connection pool on every single reload while the old ones
// often stay open, and a long dev session eventually exhausts Postgres's
// max_connections entirely (every page start failing with "sorry, too
// many clients already", which looks like random, unrelated pages being
// broken). Stashing the instance on `globalThis` survives the reload so
// the same client — and the same pool — gets reused instead.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Role-scoped access control — every admin route must call this before
// touching data, not just hide UI elements. See plan section 11E.
export async function requireAdminRole(adminId: string, allowed: string[]) {
  const roleRecord = await prisma.adminRole.findFirst({ where: { adminId } });
  if (!roleRecord) return false;
  if (roleRecord.role === "super_admin") return true;
  return allowed.includes(roleRecord.role);
}
