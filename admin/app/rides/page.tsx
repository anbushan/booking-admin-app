import { prisma } from "../../lib/prisma";
import { getSession, requireRole } from "../../lib/session";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import AdminShell from "../../components/AdminShell";
import Pagination from "../../components/Pagination";
import { EmptyState } from "../../components/EmptyState";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;

async function cancelRide(formData: FormData) {
  "use server";
  const rideId = formData.get("rideId") as string;
  await prisma.$transaction([
    prisma.ride.update({ where: { id: rideId }, data: { status: "CANCELLED" } }),
    prisma.booking.updateMany({
      where: { rideId, status: { in: ["BOOKED", "AWAITING_PAYMENT", "CONFIRMED"] } },
      data: { status: "CANCELLED", cancelledBy: "DRIVER", cancelledAt: new Date() },
    }),
  ]);
  // TODO: notify affected passengers and trigger refunds where relevant.
  revalidatePath("/rides");
}

export default async function RidesPage({ searchParams }: { searchParams: { page?: string } }) {
  const session = getSession();
  if (!requireRole(session, ["support"])) {
    redirect("/login");
  }

  const page = Math.max(1, Number(searchParams.page || 1));

  const [rides, total] = await Promise.all([
    prisma.ride.findMany({
      include: { driver: { select: { name: true, phone: true } } },
      orderBy: { travelDate: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.ride.count(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <AdminShell activeHref="/rides">
      <div style={{ padding: 24, fontFamily: "sans-serif" }}>
        <h1 style={{ fontSize: 20, fontWeight: 500 }}>All rides</h1>

        <table style={{ width: "100%", marginTop: 16, borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #E3E1D8" }}>
              <th style={{ padding: "8px 4px" }}>Route</th>
              <th style={{ padding: "8px 4px" }}>Driver</th>
              <th style={{ padding: "8px 4px" }}>Date</th>
              <th style={{ padding: "8px 4px" }}>Status</th>
              <th style={{ padding: "8px 4px" }}></th>
            </tr>
          </thead>
          <tbody>
            {rides.map((r) => (
              <tr key={r.id} style={{ borderBottom: "1px solid #E3E1D8" }}>
                <td style={{ padding: "8px 4px" }}>
                  <a href={`/rides/${r.id}`} style={{ color: "#0C447C" }}>
                    {r.sourceAddress} to {r.destAddress}
                  </a>
                </td>
                <td style={{ padding: "8px 4px" }}>{r.driver.name || r.driver.phone}</td>
                <td style={{ padding: "8px 4px" }}>{r.travelDate.toLocaleDateString()}</td>
                <td style={{ padding: "8px 4px" }}>{r.status}</td>
                <td style={{ padding: "8px 4px" }}>
                  {r.status === "PUBLISHED" && (
                    <form action={cancelRide}>
                      <input type="hidden" name="rideId" value={r.id} />
                      <button
                        type="submit"
                        style={{ background: "#fff", border: "1px solid #E3E1D8", borderRadius: 6, padding: "4px 10px", fontSize: 12 }}
                      >
                        Cancel
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rides.length === 0 && <EmptyState title="No rides yet" />}
        <Pagination page={page} totalPages={totalPages} basePath="/rides" />
      </div>
    </AdminShell>
  );
}
