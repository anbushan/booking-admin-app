import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

// Role-scoped access control — every admin route must call this before
// touching data, not just hide UI elements. See plan section 11E.
export async function requireAdminRole(adminId: string, allowed: string[]) {
  const roleRecord = await prisma.adminRole.findFirst({ where: { adminId } });
  if (!roleRecord) return false;
  if (roleRecord.role === "super_admin") return true;
  return allowed.includes(roleRecord.role);
}
