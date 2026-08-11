import { prisma } from "../../../lib/prisma";
import { getSession, requireRole } from "../../../lib/session";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import AdminShell from "../../../components/AdminShell";

import { PageHeader } from "../../../components/PageHeader";
import { Badge } from "../../../components/Badge";
import { SubmitButton } from "../../../components/SubmitButton";
import { ChangeRoleForm } from "../../../components/ChangeRoleForm";
import { redirectWithToast } from "../../../lib/toastRedirect";
import { isRedirectError } from "../../../lib/actionError";
import { PasswordInput } from "../../../components/PasswordInput";
import { UserCog } from "lucide-react";
export const dynamic = "force-dynamic";

const ROLES = ["super_admin", "finance", "verification", "support"];

async function createAdmin(formData: FormData) {
  "use server";
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const role = formData.get("role") as string;

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const admin = await prisma.adminUser.create({ data: { email, passwordHash } });
    await prisma.adminRole.create({ data: { adminId: admin.id, role } });

    revalidatePath("/settings/roles");
    redirectWithToast("/settings/roles", `Admin account created for ${email}.`);
  } catch (err: any) {
    if (isRedirectError(err)) throw err;
    // P2002 is Prisma's unique-constraint code — the email column is
    // unique, so this is almost always "that email's already an admin".
    const message = err?.code === "P2002" ? `${email} is already an admin.` : "Couldn't create admin account. Try again.";
    redirectWithToast("/settings/roles", message, "error");
  }
}

async function changeRole(formData: FormData) {
  "use server";
  const adminId = formData.get("adminId") as string;
  const role = formData.get("role") as string;

  try {
    const existing = await prisma.adminRole.findFirst({ where: { adminId } });
    if (existing) {
      await prisma.adminRole.update({ where: { id: existing.id }, data: { role } });
    } else {
      await prisma.adminRole.create({ data: { adminId, role } });
    }
    revalidatePath("/settings/roles");
    redirectWithToast("/settings/roles", "Role updated.");
  } catch (err) {
    if (isRedirectError(err)) throw err;
    redirectWithToast("/settings/roles", "Couldn't update role. Try again.", "error");
  }
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
                  <ChangeRoleForm
                    action={changeRole}
                    adminId={a.id}
                    adminEmail={a.email}
                    roles={ROLES}
                    currentRole={roleByAdminId[a.id] || "support"}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 style={{ fontSize: 15, fontWeight: 500, marginTop: 24 }}>Add admin</h2>
        <form action={createAdmin} style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input name="email" type="email" placeholder="email" required className="admin-input" />
          <PasswordInput name="password" placeholder="password" required autoComplete="new-password" height={36} style={{ minWidth: 160 }} />
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
