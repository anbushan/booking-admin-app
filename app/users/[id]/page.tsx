import { prisma } from "../../../lib/prisma";
import { getSession, requireRole } from "../../../lib/session";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import AdminShell from "../../../components/AdminShell";
import { EmptyState } from "../../../components/EmptyState";

export const dynamic = "force-dynamic";

async function toggleSuspend(formData: FormData) {
  "use server";
  const userId = formData.get("userId") as string;
  const currentlyDisabled = formData.get("currentlyDisabled") === "true";
  await prisma.user.update({ where: { id: userId }, data: { disabled: !currentlyDisabled } });
  revalidatePath(`/users/${userId}`);
}

export default async function UserDetailPage({ params }: { params: { id: string } }) {
  const session = getSession();
  if (!requireRole(session, ["support"])) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({ where: { id: params.id } });
  if (!user) redirect("/users");

  const [bookings, rides] = await Promise.all([
    prisma.booking.findMany({
      where: { passengerId: params.id },
      include: { ride: { select: { sourceAddress: true, destAddress: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.ride.findMany({
      where: { driverId: params.id },
      orderBy: { travelDate: "desc" },
      take: 10,
    }),
  ]);

  return (
    <AdminShell activeHref="/users">
      <div style={{ padding: 24, fontFamily: "sans-serif" }}>
        <a href="/users" style={{ fontSize: 13, color: "#5F5E5A" }}>{"< Back to users"}</a>
        <h1 style={{ fontSize: 20, fontWeight: 500, marginTop: 8 }}>
          {user.name || user.phone}
        </h1>
        <div style={{ fontSize: 13, color: "#5F5E5A", marginTop: 4 }}>
          {user.phone} · {user.role} · {user.ratingAvg ? `${user.ratingAvg.toFixed(1)} rating` : "No rating yet"}
        </div>
        <div style={{ marginTop: 8 }}>
          <span style={{ fontSize: 12, color: user.disabled ? "#A32D2D" : "#3B6D11" }}>
            {user.disabled ? "Suspended" : "Active"}
          </span>
        </div>

        <form action={toggleSuspend} style={{ marginTop: 12 }}>
          <input type="hidden" name="userId" value={user.id} />
          <input type="hidden" name="currentlyDisabled" value={String(user.disabled)} />
          <button
            type="submit"
            style={{
              background: user.disabled ? "#1A1A18" : "#fff",
              color: user.disabled ? "#fff" : "#A32D2D",
              border: "1px solid #E3E1D8",
              borderRadius: 6,
              padding: "8px 14px",
              fontSize: 13,
            }}
          >
            {user.disabled ? "Reinstate account" : "Suspend account"}
          </button>
        </form>

        {user.role === "PASSENGER" && (
          <>
            <h2 style={{ fontSize: 15, fontWeight: 500, marginTop: 24 }}>Recent bookings</h2>
            {bookings.map((b) => (
              <div key={b.id} style={{ fontSize: 13, padding: "8px 0", borderBottom: "1px solid #E3E1D8" }}>
                {b.ride.sourceAddress} to {b.ride.destAddress} — {b.status}
              </div>
            ))}
            {bookings.length === 0 && <EmptyState title="No bookings yet" />}
          </>
        )}

        {user.role === "DRIVER" && (
          <>
            <h2 style={{ fontSize: 15, fontWeight: 500, marginTop: 24 }}>Recent rides</h2>
            {rides.map((r) => (
              <div key={r.id} style={{ fontSize: 13, padding: "8px 0", borderBottom: "1px solid #E3E1D8" }}>
                {r.sourceAddress} to {r.destAddress} — {r.status}
              </div>
            ))}
            {rides.length === 0 && <EmptyState title="No rides published yet" />}
          </>
        )}
      </div>
    </AdminShell>
  );
}
