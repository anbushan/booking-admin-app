import { prisma } from "../../lib/prisma";
import { getSession, requireRole } from "../../lib/session";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import AdminShell from "../../components/AdminShell";
import Pagination from "../../components/Pagination";
import { EmptyState } from "../../components/EmptyState";
import { PageHeader } from "../../components/PageHeader";
import { Badge } from "../../components/Badge";
import { SearchFilterBar } from "../../components/SearchFilterBar";
import { SortableTh } from "../../components/SortableTh";
import { SubmitButton } from "../../components/SubmitButton";
import { ConfirmButton } from "../../components/ConfirmButton";
import { redirectWithToast } from "../../lib/toastRedirect";
import { Users as UsersIcon } from "lucide-react";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;

const SORT_FIELDS: Record<string, string> = {
  name: "name",
  rating: "ratingAvg",
  createdAt: "createdAt",
};

async function toggleSuspend(formData: FormData) {
  "use server";
  const userId = formData.get("userId") as string;
  const currentlyDisabled = formData.get("currentlyDisabled") === "true";
  await prisma.user.update({
    where: { id: userId },
    data: { disabled: !currentlyDisabled },
  });
  revalidatePath("/users");
  redirectWithToast("/users", currentlyDisabled ? "Account reinstated." : "Account suspended.");
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: { page?: string; q?: string; role?: string; status?: string; sortBy?: string; sortDir?: string };
}) {
  const session = getSession();
  if (!requireRole(session, ["support"])) {
    redirect("/login");
  }

  const page = Math.max(1, Number(searchParams.page || 1));
  const { q, role, status, sortBy, sortDir } = searchParams;

  const where = {
    ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { phone: { contains: q } }] } : {}),
    ...(role ? { role } : {}),
    ...(status === "suspended" ? { disabled: true } : status === "active" ? { disabled: false } : {}),
  };
  const orderField = SORT_FIELDS[sortBy || ""] || "createdAt";
  const orderDir = sortDir === "asc" ? "asc" : sortDir === "desc" ? "desc" : "desc";

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { [orderField]: orderDir },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.user.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const extraParams = { q, role, status };

  return (
    <AdminShell activeHref="/users">
      <div style={{ padding: 24 }}>
        <PageHeader icon={UsersIcon} title="Users" subtitle={`${total} total`} />

        <SearchFilterBar
          basePath="/users"
          q={q}
          searchPlaceholder="Search name or phone..."
          filters={[
            { name: "role", label: "All roles", value: role, options: [{ value: "DRIVER", label: "Driver" }, { value: "PASSENGER", label: "Passenger" }] },
            { name: "status", label: "All statuses", value: status, options: [{ value: "active", label: "Active" }, { value: "suspended", label: "Suspended" }] },
          ]}
        />

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginTop: 8 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #E3E1D8" }}>
              <SortableTh label="Name" field="name" currentSortBy={sortBy} currentSortDir={sortDir} basePath="/users" extraParams={extraParams} />
              <th style={{ padding: "8px 4px" }}>Phone</th>
              <th style={{ padding: "8px 4px" }}>Role</th>
              <SortableTh label="Rating" field="rating" currentSortBy={sortBy} currentSortDir={sortDir} basePath="/users" extraParams={extraParams} />
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
                <td style={{ padding: "8px 4px" }}><Badge tone={u.role === "DRIVER" ? "info" : "neutral"}>{u.role}</Badge></td>
                <td style={{ padding: "8px 4px" }}>{u.ratingAvg?.toFixed(1) || "—"}</td>
                <td style={{ padding: "8px 4px" }}>
                  <Badge tone={u.disabled ? "danger" : "success"}>{u.disabled ? "Suspended" : "Active"}</Badge>
                </td>
                <td style={{ padding: "8px 4px" }}>
                  {u.disabled ? (
                    <form action={toggleSuspend}>
                      <input type="hidden" name="userId" value={u.id} />
                      <input type="hidden" name="currentlyDisabled" value="true" />
                      <SubmitButton className="admin-btn admin-btn-primary admin-btn-sm" pendingLabel="Reinstating...">
                        Reinstate
                      </SubmitButton>
                    </form>
                  ) : (
                    <ConfirmButton
                      action={toggleSuspend}
                      hiddenFields={{ userId: u.id, currentlyDisabled: "false" }}
                      label="Suspend"
                      className="admin-btn admin-btn-secondary admin-btn-sm"
                      confirmTitle="Suspend this account?"
                      confirmMessage={`${u.name || u.phone} won't be able to sign in or use the app until reinstated.`}
                      confirmLabel="Suspend"
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && <EmptyState title="No users match" />}
        <Pagination page={page} totalPages={totalPages} basePath="/users" extraParams={{ ...extraParams, sortBy, sortDir }} />
      </div>
    </AdminShell>
  );
}
