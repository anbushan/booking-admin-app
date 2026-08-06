import { prisma } from "../../../lib/prisma";
import { getSession, requireRole } from "../../../lib/session";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import AdminShell from "../../../components/AdminShell";
import { EmptyState } from "../../../components/EmptyState";

export const dynamic = "force-dynamic";

async function cancelRide(formData: FormData) {
  "use server";
  const rideId = formData.get("rideId") as string;
  await prisma.$transaction([
    prisma.ride.update({ where: { id: rideId }, data: { status: "CANCELLED" } }),
    prisma.booking.updateMany({
      where: { rideId, status: { in: ["BOOKED", "CONFIRMED"] } },
      data: { status: "CANCELLED" },
    }),
  ]);
  revalidatePath(`/rides/${rideId}`);
}

export default async function RideDetailPage({ params }: { params: { id: string } }) {
  const session = getSession();
  if (!requireRole(session, ["support"])) {
    redirect("/login");
  }

  const ride = await prisma.ride.findUnique({
    where: { id: params.id },
    include: {
      driver: { select: { name: true, phone: true, ratingAvg: true } },
      bookings: { include: { passenger: { select: { name: true, phone: true } } } },
    },
  });
  if (!ride) redirect("/rides");

  return (
    <AdminShell activeHref="/rides">
      <div style={{ padding: 24, fontFamily: "sans-serif" }}>
        <a href="/rides" style={{ fontSize: 13, color: "#5F5E5A" }}>{"< Back to rides"}</a>
        <h1 style={{ fontSize: 20, fontWeight: 500, marginTop: 8 }}>
          {ride.sourceAddress} to {ride.destAddress}
        </h1>
        <div style={{ fontSize: 13, color: "#5F5E5A", marginTop: 4 }}>
          Driver: {ride.driver.name || ride.driver.phone} · {ride.travelDate.toLocaleString()} ·
          Rs {Number(ride.pricePerSeat)}/seat · {ride.status}
        </div>

        {ride.status === "PUBLISHED" && (
          <form action={cancelRide} style={{ marginTop: 12 }}>
            <input type="hidden" name="rideId" value={ride.id} />
            <button type="submit" style={{ background: "#fff", color: "#A32D2D", border: "1px solid #E3E1D8", borderRadius: 6, padding: "8px 14px", fontSize: 13 }}>
              Cancel this ride
            </button>
          </form>
        )}

        <h2 style={{ fontSize: 15, fontWeight: 500, marginTop: 24 }}>Bookings on this ride</h2>
        {ride.bookings.map((b) => (
          <div key={b.id} style={{ fontSize: 13, padding: "8px 0", borderBottom: "1px solid #E3E1D8" }}>
            {b.passenger.name || b.passenger.phone} — {b.seatsBooked} seat(s) — {b.status}
          </div>
        ))}
        {ride.bookings.length === 0 && <EmptyState title="No bookings yet" />}
      </div>
    </AdminShell>
  );
}
