import { prisma } from "../../../lib/prisma";
import { getSession, requireRole } from "../../../lib/session";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import AdminShell from "../../../components/AdminShell";
import { EmptyState } from "../../../components/EmptyState";
import { PageHeader } from "../../../components/PageHeader";
import { Badge } from "../../../components/Badge";
import { ConfirmButton } from "../../../components/ConfirmButton";
import { redirectWithToast } from "../../../lib/toastRedirect";
import { isRedirectError } from "../../../lib/actionError";
import { Car, ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

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
    revalidatePath(`/rides/${rideId}`);
    redirectWithToast(`/rides/${rideId}`, "Ride cancelled.");
  } catch (err) {
    if (isRedirectError(err)) throw err;
    redirectWithToast(`/rides/${rideId}`, "Couldn't cancel ride. Try again.", "error");
  }
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
      <div style={{ padding: 24 }}>
        <a href="/rides" style={{ fontSize: 13, color: "#5F5E5A", display: "inline-flex", alignItems: "center", gap: 4 }}>
          <ArrowLeft size={14} /> Back to rides
        </a>
        <div style={{ marginTop: 12 }}>
          <PageHeader icon={Car} title={`${ride.sourceAddress} to ${ride.destAddress}`} />
        </div>
        <div style={{ fontSize: 13, color: "#5F5E5A", marginTop: -12, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span>Driver: {ride.driver.name || ride.driver.phone} · {ride.travelDate.toLocaleString()} · Rs {Number(ride.pricePerSeat)}/seat</span>
          <Badge>{ride.status}</Badge>
        </div>

        {ride.status === "PUBLISHED" && (
          <div style={{ marginTop: 12 }}>
            <ConfirmButton
              action={cancelRide}
              hiddenFields={{ rideId: ride.id }}
              label="Cancel this ride"
              confirmTitle="Cancel this ride?"
              confirmMessage="Every open booking on this ride gets cancelled too. This can't be undone from here."
              confirmLabel="Cancel ride"
            />
          </div>
        )}

        {Array.isArray(ride.routeStops) && ride.routeStops.length > 0 && (
          <>
            <h2 style={{ fontSize: 15, fontWeight: 500, marginTop: 24 }}>
              Route ({ride.routeDistanceKm} km · {ride.routeDurationMinutes} min)
            </h2>
            {(ride.routeStops as any[]).map((stop, i) => (
              <div key={i} style={{ fontSize: 13, padding: "6px 0", borderBottom: "1px solid #E3E1D8" }}>
                {stop.placeName} — {stop.distanceKm} km / {stop.durationMinutes} min from source
              </div>
            ))}
          </>
        )}

        <h2 style={{ fontSize: 15, fontWeight: 500, marginTop: 24 }}>Bookings on this ride</h2>
        {ride.bookings.map((b) => (
          <div key={b.id} style={{ fontSize: 13, padding: "8px 0", borderBottom: "1px solid #E3E1D8", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <span>{b.passenger.name || b.passenger.phone} — {b.seatsBooked} seat(s)</span>
            <Badge>{b.status}</Badge>
          </div>
        ))}
        {ride.bookings.length === 0 && <EmptyState title="No bookings yet" />}
      </div>
    </AdminShell>
  );
}
