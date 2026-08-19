import { prisma } from "../../../lib/prisma";
import { getSession, requireRole } from "../../../lib/session";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import AdminShell from "../../../components/AdminShell";
import { EmptyState } from "../../../components/EmptyState";
import { PageHeader } from "../../../components/PageHeader";
import { Badge } from "../../../components/Badge";
import { Breadcrumb } from "../../../components/Breadcrumb";
import { SubmitButton } from "../../../components/SubmitButton";
import { ConfirmButton } from "../../../components/ConfirmButton";
import { redirectWithToast } from "../../../lib/toastRedirect";
import { isRedirectError } from "../../../lib/actionError";
import { User as UserIcon } from "lucide-react";

export const dynamic = "force-dynamic";

async function toggleSuspend(formData: FormData) {
  "use server";
  const userId = formData.get("userId") as string;
  const currentlyDisabled = formData.get("currentlyDisabled") === "true";
  try {
    await prisma.user.update({ where: { id: userId }, data: { disabled: !currentlyDisabled } });
    revalidatePath(`/users/${userId}`);
    redirectWithToast(`/users/${userId}`, currentlyDisabled ? "Account reinstated." : "Account suspended.");
  } catch (err) {
    if (isRedirectError(err)) throw err;
    redirectWithToast(`/users/${userId}`, "Couldn't update account. Try again.", "error");
  }
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
      include: { ride: { select: { id: true, sourceAddress: true, destAddress: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.ride.findMany({
      where: { driverId: params.id },
      orderBy: { travelDate: "desc" },
      take: 10,
    }),
  ]);

  const passengerVerification = user.role === "PASSENGER"
    ? await prisma.passengerVerification.findUnique({ where: { userId: params.id } })
    : null;

  const cooldownActive = !!user.bookingCooldownUntil && user.bookingCooldownUntil > new Date();
  const isSelfDeleted = !!user.deletedAt;

  return (
    <AdminShell activeHref="/users">
      <div style={{ padding: 24 }}>
        <Breadcrumb items={[{ label: "Users", href: "/users" }, { label: user.name || user.phone }]} />
        <div style={{ marginTop: 12 }}>
          <PageHeader icon={UserIcon} title={user.name || user.phone} />
        </div>
        <div style={{ fontSize: 13, color: "#5F5E5A", marginTop: -12, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span>{user.phone}</span>
          <Badge tone={user.role === "DRIVER" ? "info" : "neutral"}>{user.role}</Badge>
          <span>{user.ratingAvg ? `${user.ratingAvg.toFixed(1)} rating` : "No rating yet"}</span>
          {/* A self-deleted account already has its disabled flag set
              (see User.deletedAt's own comment) — badging it "Suspended"
              alongside every admin-suspended account made the two
              indistinguishable, and this account's PII is already
              scrubbed, so there's nothing left to "reinstate." */}
          {isSelfDeleted ? (
            <Badge tone="neutral">Account deleted (self-service)</Badge>
          ) : (
            <Badge tone={user.disabled ? "danger" : "success"}>{user.disabled ? "Suspended" : "Active"}</Badge>
          )}
          {cooldownActive && (
            <Badge tone="warning">{`Booking cooldown until ${user.bookingCooldownUntil!.toLocaleString()}`}</Badge>
          )}
        </div>

        {isSelfDeleted ? (
          <div style={{ marginTop: 16, fontSize: 13, color: "#888780" }}>
            Deleted by the user on {user.deletedAt!.toLocaleDateString()} — their profile info is scrubbed; ride/booking history stays for the other party's records. Nothing to suspend or reinstate here.
          </div>
        ) : (
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
        )}

        {user.role === "PASSENGER" && (
          <>
            <div className="admin-card" style={{ padding: 16, marginTop: 16 }}>
              <h2 style={{ fontSize: 15, fontWeight: 500, marginTop: 0 }}>Aadhaar verification (paid, Eko)</h2>
              {passengerVerification ? (
                <div style={{ fontSize: 13, padding: "10px 0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <Badge>{passengerVerification.paymentStatus}</Badge>
                    <Badge>{passengerVerification.aadhaarStatus}</Badge>
                    {passengerVerification.amountPaidInr != null && <span style={{ color: "#5F5E5A" }}>Rs {passengerVerification.amountPaidInr.toString()} paid</span>}
                  </div>
                  {passengerVerification.aadhaarVerifiedAt && (
                    <div style={{ color: "#888780", marginTop: 4 }}>Resolved {passengerVerification.aadhaarVerifiedAt.toLocaleString()}</div>
                  )}
                </div>
              ) : (
                <EmptyState title="Never started a paid Aadhaar check" />
              )}
            </div>

            <div className="admin-card" style={{ padding: 16, marginTop: 16 }}>
              <h2 style={{ fontSize: 15, fontWeight: 500, marginTop: 0 }}>Recent bookings</h2>
              {bookings.map((b) => (
                <div key={b.id} style={{ fontSize: 13, padding: "8px 0", borderBottom: "1px solid #E3E1D8", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <Link href={`/rides/${b.ride.id}`} style={{ color: "#0C447C" }}>
                    {b.ride.sourceAddress} to {b.ride.destAddress}
                  </Link>
                  <Badge>{b.status}</Badge>
                </div>
              ))}
              {bookings.length === 0 && <EmptyState title="No bookings yet" />}
            </div>
          </>
        )}

        {user.role === "DRIVER" && (
          <div className="admin-card" style={{ padding: 16, marginTop: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 500, marginTop: 0 }}>Recent rides</h2>
            {rides.map((r) => (
              <div key={r.id} style={{ fontSize: 13, padding: "8px 0", borderBottom: "1px solid #E3E1D8", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <Link href={`/rides/${r.id}`} style={{ color: "#0C447C" }}>
                  {r.sourceAddress} to {r.destAddress}
                </Link>
                <Badge>{r.status}</Badge>
              </div>
            ))}
            {rides.length === 0 && <EmptyState title="No rides published yet" />}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
