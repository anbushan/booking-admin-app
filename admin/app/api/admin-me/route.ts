import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { getSession } from "../../../lib/session";

// AdminShell is a client component (it owns interactive sidebar/menu
// state), so it can't call getSession()/prisma directly the way every
// page's own server component does — this is the one small API route
// that lets it fetch "who am I" itself on mount, without threading an
// identity prop through all 22 pages that already render <AdminShell>.
export async function GET() {
  const session = getSession();
  if (!session) return NextResponse.json({ email: null, role: null }, { status: 401 });

  const admin = await prisma.adminUser.findUnique({
    where: { id: session.adminId },
    select: { email: true },
  });

  return NextResponse.json({ email: admin?.email || null, role: session.role });
}
