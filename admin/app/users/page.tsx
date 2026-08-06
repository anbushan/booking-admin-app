import { prisma } from "../../lib/prisma";
import { getSession, requireRole } from "../../lib/session";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import AdminShell from "../../components/AdminShell";
import Pagination from "../../components/Pagination";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;

async function toggleSuspend(formData: FormData) {
  "use server";
  const userId = formData.get("userId") as string;
  const currentlyDisabled = formData.get("currentlyDisabled") === "true";
  await prisma.user.update({
    where: { id: userId },
    data: { disabled: !currentlyDisabled },
  });
  revalidatePath("/users");
}

export default async function UsersPage({ searchParams }: { searchParams: { page?: string } }) {
  const session = getSession();
  if (!requireRole(session, ["support"])) {
    redirect("/login");
  }

  const page = Math.max(1, Number(searchParams.page || 1));

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.user.count(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <AdminShell activeHref="/users">
      <div style={{ padding: 24, fontFamily: "sans-serif" }}>
        <h1 style={{ fontSize: 20, fontWeight: 500 }}>Users</h1>

        <table style={{ width: "100%", marginTop: 16, borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #E3E1D8" }}>
              <th style={{ padding: "8px 4px" }}>Name</th>
              <th style={{ padding: "8px 4px" }}>Phone</th>
              <th style={{ padding: "8px 4px" }}>Role</th>
              <th style={{ padding: "8px 4px" }}>Rating</th>
              <th style={{ padding: "8px 4px" }}>Status</th>
              <th style={{ padding: "8px 4px" }}></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={{ borderBottom: "1px solid #E3E1D8" }}>
                <td style={{ padding: "8px 4px" }}>
                  <a href={u.role === "DRIVER" ? `/drivers/${u.id}` : `/users/${u.id}`} style={{ color: "#0C447C" }}>{u.name || "—"}</a>
                </td>
                <td style={{ padding: "8px 4px" }}>{u.phone}</td>
                <td style={{ padding: "8px 4px" }}>{u.role}</td>
                <td style={{ padding: "8px 4px" }}>{u.ratingAvg?.toFixed(1) || "—"}</td>
                <td style={{ padding: "8px 4px" }}>
                  <span style={{ color: u.disabled ? "#A32D2D" : "#3B6D11" }}>
                    {u.disabled ? "Suspended" : "Active"}
                  </span>
                </td>
                <td style={{ padding: "8px 4px" }}>
                  <form action={toggleSuspend}>
                    <input type="hidden" name="userId" value={u.id} />
                    <input type="hidden" name="currentlyDisabled" value={String(u.disabled)} />
                    <button
                      type="submit"
                      style={{
                        background: "#fff",
                        border: "1px solid #E3E1D8",
                        borderRadius: 6,
                        padding: "4px 10px",
                        fontSize: 12,
                      }}
                    >
                      {u.disabled ? "Reinstate" : "Suspend"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && <EmptyState title="No users yet" />}
        <Pagination page={page} totalPages={totalPages} basePath="/users" />
      </div>
    </AdminShell>
  );
}
