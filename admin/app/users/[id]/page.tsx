import { prisma } from "../../../lib/prisma";
import { getSession, requireRole } from "../../../lib/session";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import AdminShell from "../../../components/AdminShell";
import { EmptyState } from "../../../components/EmptyState";
import { PageHeader } from "../../../components/PageHeader";
import { Badge } from "../../../components/Badge";
import { SubmitButton } from "../../../components/SubmitButton";
import { ConfirmButton } from "../../../components/ConfirmButton";
import { redirectWithToast } from "../../../lib/toastRedirect";
import { User as UserIcon, ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

async function toggleSuspend(formData: FormData) {
  "use server";
  const userId = formData.get("userId") as string;
  const currentlyDisabled = formData.get("currentlyDisabled") === "true";
  await prisma.user.update({ where: { id: userId }, data: { disabled: !currentlyDisabled } });
  revalidatePath(`/users/${userId}`);
  redirectWithToast(`/users/${userId}`, currentlyDisabled ? "Account reinstated." : "Account suspended.");
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
      <div style={{ padding: 24 }}>
        <a href="/users" style={{ fontSize: 13, color: "#5F5E5A", display: "inline-flex", alignItems: "center", gap: 4 }}>
          <ArrowLeft size={14} /> Back to users
        </a>
        <div style={{ marginTop: 12 }}>
          <PageHeader icon={UserIcon} title={user.name || user.phone} />
        </div>
        <div style={{ fontSize: 13, color: "#5F5E5A", marginTop: -12, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span>{user.phone}</span>
          <Badge tone={user.role === "DRIVER" ? "info" : "neutral"}>{user.role}</Badge>
          <span>{user.ratingAvg ? `${user.ratingAvg.toFixed(1)} rating` : "No rating yet"}</span>
          <Badge tone={user.disabled ? "danger" : "success"}>{user.disabled ? "Suspended" : "Active"}</Badge>
        </div>

        <div style={{ marginTop: 16 }}>
          {user.disabled ? (
            <form action={toggleSuspend}>
              <input type="hidden" name="userId" value={user.id} />
              <input type="hidden" name="currentlyDisabled" value="true" />
              <SubmitButton pendingLabel="Reinstating...">Reinstate account</SubmitButton>
            </form>
          ) : (
            <ConfirmButton
              action={toggleSuspend}
              hiddenFields={{ userId: user.id, currentlyDisabled: "false" }}
              label="Suspend account"
              confirmTitle="Suspend this account?"
              confirmMessage={`${user.name || user.phone} won't be able to sign in or use the app until reinstated.`}
              confirmLabel="Suspend"
            />
          )}
        </div>

        {user.role === "PASSENGER" && (
          <>
            <h2 style={{ fontSize: 15, fontWeight: 500, marginTop: 24 }}>Recent bookings</h2>
            {bookings.map((b) => (
              <div key={b.id} style={{ fontSize: 13, padding: "8px 0", borderBottom: "1px solid #E3E1D8", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <span>{b.ride.sourceAddress} to {b.ride.destAddress}</span>
                <Badge>{b.status}</Badge>
              </div>
            ))}
            {bookings.length === 0 && <EmptyState title="No bookings yet" />}
          </>
        )}

        {user.role === "DRIVER" && (
          <>
            <h2 style={{ fontSize: 15, fontWeight: 500, marginTop: 24 }}>Recent rides</h2>
            {rides.map((r) => (
              <div key={r.id} style={{ fontSize: 13, padding: "8px 0", borderBottom: "1px solid #E3E1D8", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <span>{r.sourceAddress} to {r.destAddress}</span>
                <Badge>{r.status}</Badge>
              </div>
            ))}
            {rides.length === 0 && <EmptyState title="No rides published yet" />}
          </>
        )}
      </div>
    </AdminShell>
  );
}
