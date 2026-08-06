import { prisma } from "../../../lib/prisma";
import { getSession, requireRole } from "../../../lib/session";
import { redirect } from "next/navigation";
import AdminShell from "../../../components/AdminShell";

export const dynamic = "force-dynamic";

export default async function BookingDetailPage({ params }: { params: { id: string } }) {
  const session = getSession();
  if (!requireRole(session, ["support"])) {
    redirect("/login");
  }

  const booking = await prisma.booking.findUnique({
    where: { id: params.id },
    include: {
      ride: { include: { driver: { select: { name: true, phone: true } } } },
      passenger: { select: { name: true, phone: true } },
      refund: true,
    },
  });
  if (!booking) redirect("/bookings");

  const amount = Number(booking.ride.pricePerSeat) * booking.seatsBooked;

  return (
    <AdminShell activeHref="/bookings">
      <div style={{ padding: 24, fontFamily: "sans-serif" }}>
        <a href="/bookings" style={{ fontSize: 13, color: "#5F5E5A" }}>{"< Back to bookings"}</a>
        <h1 style={{ fontSize: 20, fontWeight: 500, marginTop: 8 }}>
          Booking {booking.id.slice(0, 8)}
        </h1>

        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, fontSize: 13 }}>
          <div>
            <div style={{ color: "#888780" }}>Passenger</div>
            <div>{booking.passenger.name || booking.passenger.phone}</div>
          </div>
          <div>
            <div style={{ color: "#888780" }}>Driver</div>
            <div>{booking.ride.driver.name || booking.ride.driver.phone}</div>
          </div>
          <div>
            <div style={{ color: "#888780" }}>Route</div>
            <div>{booking.ride.sourceAddress} to {booking.ride.destAddress}</div>
          </div>
          <div>
            <div style={{ color: "#888780" }}>Amount</div>
            <div>Rs {amount}</div>
          </div>
          <div>
            <div style={{ color: "#888780" }}>Status</div>
            <div>{booking.status}</div>
          </div>
          <div>
            <div style={{ color: "#888780" }}>Trip completed</div>
            <div>{booking.tripCompletedAt?.toLocaleString() || "—"}</div>
          </div>
        </div>

        {booking.refund && (
          <>
            <h2 style={{ fontSize: 15, fontWeight: 500, marginTop: 24 }}>Refund</h2>
            <div style={{ fontSize: 13 }}>
              Rs {Number(booking.refund.amount)} — {booking.refund.status} — estimated by{" "}
              {booking.refund.estimatedCompletionAt.toLocaleDateString()}
            </div>
          </>
        )}
      </div>
    </AdminShell>
  );
}
