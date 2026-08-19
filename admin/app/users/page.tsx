import { prisma } from "../../lib/prisma";
import { getSession, requireRole } from "../../lib/session";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import AdminShell from "../../components/AdminShell";
import Pagination from "../../components/Pagination";
import { EmptyState } from "../../components/EmptyState";
import { PageHeader } from "../../components/PageHeader";
import { Badge } from "../../components/Badge";
import { SearchFilterBar } from "../../components/SearchFilterBar";
import { SortableTh } from "../../components/SortableTh";
import { ListRow } from "../../components/ListRow";
import { SubmitButton } from "../../components/SubmitButton";
import { ConfirmButton } from "../../components/ConfirmButton";
import { redirectWithToast } from "../../lib/toastRedirect";
import { isRedirectError } from "../../lib/actionError";
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
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { disabled: !currentlyDisabled },
    });
    revalidatePath("/users");
    redirectWithToast("/users", currentlyDisabled ? "Account reinstated." : "Account suspended.");
  } catch (err) {
    if (isRedirectError(err)) throw err;
    redirectWithToast("/users", "Couldn't update account. Try again.", "error");
  }
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

  // Shared between the <table> (tablet/desktop) and the .admin-row-list
  // (mobile) markups below — same server action either way, just
  // avoids writing this form twice per user.
  function suspendAction(u: (typeof users)[number]) {
    return u.disabled ? (
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
    );
  }

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

        <table className="admin-table-responsive" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginTop: 8 }}>
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
                  <Link href={u.role === "DRIVER" ? `/drivers/${u.id}` : `/users/${u.id}`} style={{ color: "#0C447C" }}>{u.name || "—"}</Link>
                </td>
                <td style={{ padding: "8px 4px" }}>{u.phone}</td>
                <td style={{ padding: "8px 4px" }}><Badge tone={u.role === "DRIVER" ? "info" : "neutral"}>{u.role}</Badge></td>
                <td style={{ padding: "8px 4px" }}>{u.ratingAvg?.toFixed(1) || "—"}</td>
                <td style={{ padding: "8px 4px" }}>
                  <Badge tone={u.disabled ? "danger" : "success"}>{u.disabled ? "Suspended" : "Active"}</Badge>
                </td>
                <td style={{ padding: "8px 4px" }}>{suspendAction(u)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="admin-row-list">
          {users.map((u) => (
            <ListRow
              key={u.id}
              left={
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Link href={u.role === "DRIVER" ? `/drivers/${u.id}` : `/users/${u.id}`} style={{ color: "#0C447C", fontWeight: 500 }}>{u.name || "—"}</Link>
                    <Badge tone={u.role === "DRIVER" ? "info" : "neutral"}>{u.role}</Badge>
                  </div>
                  <div style={{ fontSize: 12, color: "#888780", marginTop: 4 }}>
                    {u.phone} · {u.ratingAvg?.toFixed(1) || "No rating"}
                  </div>
                </>
              }
              right={
                <>
                  <Badge tone={u.disabled ? "danger" : "success"}>{u.disabled ? "Suspended" : "Active"}</Badge>
                  {suspendAction(u)}
                </>
              }
            />
          ))}
        </div>
        {users.length === 0 && <EmptyState title="No users match" />}
        <Pagination page={page} totalPages={totalPages} basePath="/users" extraParams={{ ...extraParams, sortBy, sortDir }} />
      </div>
    </AdminShell>
  );
}
