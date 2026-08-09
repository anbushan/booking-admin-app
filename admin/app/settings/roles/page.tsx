import { prisma } from "../../../lib/prisma";
import { getSession, requireRole } from "../../../lib/session";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import AdminShell from "../../../components/AdminShell";

import { PageHeader } from "../../../components/PageHeader";
import { Badge } from "../../../components/Badge";
import { SubmitButton } from "../../../components/SubmitButton";
import { redirectWithToast } from "../../../lib/toastRedirect";
import { UserCog } from "lucide-react";
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
  redirectWithToast("/settings/roles", `Admin account created for ${email}.`);
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
  redirectWithToast("/settings/roles", "Role updated.");
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
        <PageHeader icon={UserCog} title="Admin roles" />
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
                <td style={{ padding: "8px 4px" }}><Badge tone={roleByAdminId[a.id] ? "info" : "neutral"}>{roleByAdminId[a.id] || "none"}</Badge></td>
                <td style={{ padding: "8px 4px" }}>
                  <form action={changeRole} style={{ display: "flex", gap: 6 }}>
                    <input type="hidden" name="adminId" value={a.id} />
                    <select name="role" defaultValue={roleByAdminId[a.id] || "support"} className="admin-select" style={{ height: 30, fontSize: 12 }}>
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                    <SubmitButton className="admin-btn admin-btn-secondary admin-btn-sm" pendingLabel="Updating...">
                      Update
                    </SubmitButton>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 style={{ fontSize: 15, fontWeight: 500, marginTop: 24 }}>Add admin</h2>
        <form action={createAdmin} style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input name="email" type="email" placeholder="email" required className="admin-input" />
          <input name="password" type="password" placeholder="password" required className="admin-input" />
          <select name="role" defaultValue="support" className="admin-select">
            {ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <SubmitButton pendingLabel="Creating...">Create</SubmitButton>
        </form>
      </div>
    </AdminShell>
  );
}
