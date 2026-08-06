import { prisma } from "../../../lib/prisma";
import { getSession, requireRole } from "../../../lib/session";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import AdminShell from "../../../components/AdminShell";

export const dynamic = "force-dynamic";

const ROLES = ["super_admin", "finance", "verification", "support"];

async function createAdmin(formData: FormData) {
  "use server";
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const role = formData.get("role") as string;

  const passwordHash = await bcrypt.hash(password, 10);
  const admin = await prisma.adminUser.create({ data: { email, passwordHash } });
  await prisma.adminRole.create({ data: { adminId: admin.id, role } });

  revalidatePath("/settings/roles");
}

async function changeRole(formData: FormData) {
  "use server";
  const adminId = formData.get("adminId") as string;
  const role = formData.get("role") as string;

  const existing = await prisma.adminRole.findFirst({ where: { adminId } });
  if (existing) {
    await prisma.adminRole.update({ where: { id: existing.id }, data: { role } });
  } else {
    await prisma.adminRole.create({ data: { adminId, role } });
  }
  revalidatePath("/settings/roles");
}

export default async function RolesPage() {
  const session = getSession();
  // Role management is Super Admin only — this is the one page nobody
  // else should be able to reach, matching the role table from the plan.
  if (!requireRole(session, [])) {
    redirect("/login");
  }

  const admins = await prisma.adminUser.findMany({ orderBy: { createdAt: "asc" } });
  const roles = await prisma.adminRole.findMany();
  const roleByAdminId = Object.fromEntries(roles.map((r) => [r.adminId, r.role]));

  return (
    <AdminShell activeHref="/settings/roles">
      <div style={{ padding: 24, fontFamily: "sans-serif" }}>
        <h1 style={{ fontSize: 20, fontWeight: 500 }}>Admin roles</h1>
        <p style={{ fontSize: 13, color: "#5F5E5A" }}>
          Super Admin sees everything. Finance, Verification, and Support
          are scoped per the access table — each admin page checks this
          role server-side, not just hides UI.
        </p>

        <table style={{ width: "100%", marginTop: 16, borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #E3E1D8" }}>
              <th style={{ padding: "8px 4px" }}>Email</th>
              <th style={{ padding: "8px 4px" }}>Role</th>
              <th style={{ padding: "8px 4px" }}></th>
            </tr>
          </thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a.id} style={{ borderBottom: "1px solid #E3E1D8" }}>
                <td style={{ padding: "8px 4px" }}>{a.email}</td>
                <td style={{ padding: "8px 4px" }}>{roleByAdminId[a.id] || "none"}</td>
                <td style={{ padding: "8px 4px" }}>
                  <form action={changeRole} style={{ display: "flex", gap: 6 }}>
                    <input type="hidden" name="adminId" value={a.id} />
                    <select name="role" defaultValue={roleByAdminId[a.id] || "support"} style={{ fontSize: 12, padding: 4 }}>
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                    <button type="submit" style={{ fontSize: 12, background: "#fff", border: "1px solid #E3E1D8", borderRadius: 6, padding: "4px 10px" }}>
                      Update
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 style={{ fontSize: 15, fontWeight: 500, marginTop: 24 }}>Add admin</h2>
        <form action={createAdmin} style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
          <input name="email" type="email" placeholder="email" required style={{ height: 34, border: "1px solid #E3E1D8", borderRadius: 6, padding: "0 8px", fontSize: 13 }} />
          <input name="password" type="password" placeholder="password" required style={{ height: 34, border: "1px solid #E3E1D8", borderRadius: 6, padding: "0 8px", fontSize: 13 }} />
          <select name="role" defaultValue="support" style={{ fontSize: 13, height: 34 }}>
            {ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <button type="submit" style={{ background: "#1A1A18", color: "#fff", border: "none", borderRadius: 6, padding: "8px 14px", fontSize: 13 }}>
            Create
          </button>
        </form>
      </div>
    </AdminShell>
  );
}
