import { prisma } from "../../lib/prisma";
import { getSession, requireRole } from "../../lib/session";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import AdminShell from "../../components/AdminShell";
import { PageHeader } from "../../components/PageHeader";
import { Badge } from "../../components/Badge";
import { Car } from "lucide-react";
import Pagination from "../../components/Pagination";
import { EmptyState } from "../../components/EmptyState";
import { SearchFilterBar } from "../../components/SearchFilterBar";
import { SortableTh } from "../../components/SortableTh";
import { ListRow } from "../../components/ListRow";
import { ConfirmButton } from "../../components/ConfirmButton";
import { redirectWithToast } from "../../lib/toastRedirect";
import { isRedirectError } from "../../lib/actionError";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;

const RIDE_STATUSES = ["PUBLISHED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "EXPIRED"];
const SORT_FIELDS: Record<string, string> = { date: "travelDate", price: "pricePerSeat" };

async function cancelRide(formData: FormData) {
  "use server";
  const rideId = formData.get("rideId") as string;
  try {
    await prisma.$transaction([
      prisma.ride.update({ where: { id: rideId }, data: { status: "CANCELLED" } }),
      prisma.booking.updateMany({
        where: { rideId, status: { in: ["BOOKED", "AWAITING_PAYMENT", "CONFIRMED"] } },
        data: { status: "CANCELLED", cancelledBy: "DRIVER", cancelledAt: new Date() },
      }),
    ]);
    // TODO: notify affected passengers and trigger refunds where relevant.
    revalidatePath("/rides");
    redirectWithToast("/rides", "Ride cancelled.");
  } catch (err) {
    if (isRedirectError(err)) throw err;
    redirectWithToast("/rides", "Couldn't cancel ride. Try again.", "error");
  }
}

export default async function RidesPage({
  searchParams,
}: {
  searchParams: { page?: string; q?: string; status?: string; sortBy?: string; sortDir?: string };
}) {
  const session = getSession();
  if (!requireRole(session, ["support"])) {
    redirect("/login");
  }

  const page = Math.max(1, Number(searchParams.page || 1));
  const { q, status, sortBy, sortDir } = searchParams;

  const where = {
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { sourceAddress: { contains: q, mode: "insensitive" as const } },
            { destAddress: { contains: q, mode: "insensitive" as const } },
            { driver: { name: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };
  const orderField = SORT_FIELDS[sortBy || ""] || "travelDate";
  const orderDir = sortDir === "asc" ? "asc" : "desc";

  const [rides, total] = await Promise.all([
    prisma.ride.findMany({
      where,
      include: { driver: { select: { name: true, phone: true } } },
      orderBy: { [orderField]: orderDir },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.ride.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const extraParams = { q, status };

  // Shared between the <table> (tablet/desktop) and the .admin-row-list
  // (mobile) markups below.
  function cancelAction(r: (typeof rides)[number]) {
    return r.status === "PUBLISHED" ? (
      <ConfirmButton
        action={cancelRide}
        hiddenFields={{ rideId: r.id }}
        label="Cancel"
        className="admin-btn admin-btn-secondary admin-btn-sm"
        confirmTitle="Cancel this ride?"
        confirmMessage="Every open booking on this ride gets cancelled too. This can't be undone from here."
        confirmLabel="Cancel ride"
      />
    ) : null;
  }

  return (
    <AdminShell activeHref="/rides">
      <div style={{ padding: 24 }}>
        <PageHeader icon={Car} title="All rides" subtitle={`${total} total`} />

        <SearchFilterBar
          basePath="/rides"
          q={q}
          searchPlaceholder="Search route or driver..."
          filters={[{ name: "status", label: "All statuses", value: status, options: RIDE_STATUSES.map((s) => ({ value: s, label: s.replaceAll("_", " ") })) }]}
        />

        <table className="admin-table-responsive" style={{ width: "100%", marginTop: 8, borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #E3E1D8" }}>
              <th style={{ padding: "8px 4px" }}>Route</th>
              <th style={{ padding: "8px 4px" }}>Driver</th>
              <SortableTh label="Date" field="date" currentSortBy={sortBy} currentSortDir={sortDir} basePath="/rides" extraParams={extraParams} />
              <th style={{ padding: "8px 4px" }}>Status</th>
              <th style={{ padding: "8px 4px" }}></th>
            </tr>
          </thead>
          <tbody>
            {rides.map((r) => (
              <tr key={r.id} style={{ borderBottom: "1px solid #E3E1D8" }}>
                <td style={{ padding: "8px 4px" }}>
                  <Link href={`/rides/${r.id}`} style={{ color: "#0C447C" }}>
                    {r.sourceAddress} to {r.destAddress}
                  </Link>
                </td>
                <td style={{ padding: "8px 4px" }}>{r.driver.name || r.driver.phone}</td>
                <td style={{ padding: "8px 4px" }}>{r.travelDate.toLocaleDateString()}</td>
                <td style={{ padding: "8px 4px" }}><Badge>{r.status}</Badge></td>
                <td style={{ padding: "8px 4px" }}>{cancelAction(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="admin-row-list">
          {rides.map((r) => (
            <ListRow
              key={r.id}
              left={
                <>
                  <Link href={`/rides/${r.id}`} style={{ color: "#0C447C", fontWeight: 500 }}>
                    {r.sourceAddress} to {r.destAddress}
                  </Link>
                  <div style={{ fontSize: 12, color: "#888780", marginTop: 4 }}>
                    {r.driver.name || r.driver.phone} · {r.travelDate.toLocaleDateString()}
                  </div>
                </>
              }
              right={
                <>
                  <Badge>{r.status}</Badge>
                  {cancelAction(r)}
                </>
              }
            />
          ))}
        </div>
        {rides.length === 0 && <EmptyState title="No rides match" />}
        <Pagination page={page} totalPages={totalPages} basePath="/rides" extraParams={{ ...extraParams, sortBy, sortDir }} />
      </div>
    </AdminShell>
  );
}
