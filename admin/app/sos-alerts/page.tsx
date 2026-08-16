import { prisma } from "../../lib/prisma";
import { getSession, requireRole } from "../../lib/session";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import AdminShell from "../../components/AdminShell";
import { PageHeader } from "../../components/PageHeader";
import { Badge } from "../../components/Badge";
import { AlertTriangle } from "lucide-react";
import { EmptyState } from "../../components/EmptyState";
import Pagination from "../../components/Pagination";
import { SubmitButton } from "../../components/SubmitButton";
import { ConfirmButton } from "../../components/ConfirmButton";
import { redirectWithToast } from "../../lib/toastRedirect";
import { isRedirectError } from "../../lib/actionError";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;

async function acknowledgeAlert(formData: FormData) {
  "use server";
  const alertId = formData.get("alertId") as string;
  try {
    await prisma.sosAlert.update({ where: { id: alertId }, data: { status: "ACKNOWLEDGED" } });
    revalidatePath("/sos-alerts");
    redirectWithToast("/sos-alerts", "Alert acknowledged.");
  } catch (err) {
    if (isRedirectError(err)) throw err;
    redirectWithToast("/sos-alerts", "Couldn't acknowledge alert. Try again.", "error");
  }
}

async function resolveAlert(formData: FormData) {
  "use server";
  const alertId = formData.get("alertId") as string;
  try {
    await prisma.sosAlert.update({ where: { id: alertId }, data: { status: "RESOLVED" } });
    revalidatePath("/sos-alerts");
    redirectWithToast("/sos-alerts", "Alert resolved.");
  } catch (err) {
    if (isRedirectError(err)) throw err;
    redirectWithToast("/sos-alerts", "Couldn't resolve alert. Try again.", "error");
  }
}

function sosTone(status: string): "danger" | "warning" | "success" {
  if (status === "OPEN") return "danger";
  if (status === "ACKNOWLEDGED") return "warning";
  return "success";
}

export default async function SosAlertsPage({ searchParams }: { searchParams: { page?: string } }) {
  const session = getSession();
  // Support role has SOS visibility per the plan's role table, alongside
  // super_admin.
  if (!requireRole(session, ["support"])) {
    redirect("/login");
  }

  const page = Math.max(1, Number(searchParams.page || 1));

  const [alerts, total, openCount] = await Promise.all([
    prisma.sosAlert.findMany({
      include: {
        booking: {
          select: {
            id: true,
            passenger: { select: { id: true, name: true, phone: true } },
            ride: { select: { driver: { select: { id: true, name: true, phone: true } } } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.sosAlert.count(),
    // Counted separately from the current page — with pagination in
    // play, "open alerts" has to mean all of them, not just however
    // many happen to fall on whichever page is showing.
    prisma.sosAlert.count({ where: { status: "OPEN" } }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Two extra lookups, batched across the whole page rather than one
  // query per alert: who actually pressed SOS (triggeredBy is a bare
  // userId, not a relation — SosAlert can be triggered by either the
  // passenger or driver on the booking) and who the resolved emergency
  // contacts are (contactedIds is an array of EmergencyContact ids, set
  // at trigger time — see trips.routes.js).
  const triggeredByIds = Array.from(new Set(alerts.map((a) => a.triggeredBy)));
  const allContactedIds = Array.from(new Set(alerts.flatMap((a) => a.contactedIds)));
  const [triggeredByUsers, contacts] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: triggeredByIds } }, select: { id: true, name: true, phone: true } }),
    prisma.emergencyContact.findMany({ where: { id: { in: allContactedIds } }, select: { id: true, name: true, phone: true, relation: true } }),
  ]);
  const triggeredByMap = new Map(triggeredByUsers.map((u) => [u.id, u]));
  const contactMap = new Map(contacts.map((c) => [c.id, c]));

  return (
    <AdminShell activeHref="/sos-alerts">
      <div style={{ padding: 24 }}>
        <PageHeader icon={AlertTriangle} title="SOS alerts" subtitle={`${openCount} open alert(s) · ${total} total`} />

        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          {alerts.map((alert) => {
            const triggeredByUser = triggeredByMap.get(alert.triggeredBy);
            const passenger = alert.booking.passenger;
            const driver = alert.booking.ride.driver;
            const resolvedContacts = alert.contactedIds.map((id) => contactMap.get(id)).filter(Boolean) as { id: string; name: string; phone: string; relation: string | null }[];
            const mapsUrl = `https://www.google.com/maps?q=${alert.lat},${alert.lng}`;
            return (
              <div
                key={alert.id}
                style={{
                  border: "1px solid #E3E1D8",
                  borderRadius: 8,
                  padding: 16,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <Badge tone={sosTone(alert.status)}>{alert.status}</Badge>
                    <a href={`/bookings/${alert.booking.id}`} style={{ fontSize: 13, fontWeight: 500, color: "#0C447C" }}>
                      Booking {alert.booking.id}
                    </a>
                  </div>
                  <div style={{ fontSize: 12, color: "#5F5E5A", marginTop: 6 }}>
                    Passenger: {passenger.name || passenger.phone} ({passenger.phone}) · Driver: {driver.name || driver.phone} ({driver.phone})
                  </div>
                  <div style={{ fontSize: 12, color: "#5F5E5A", marginTop: 2 }}>
                    Triggered by {triggeredByUser?.id === passenger.id ? "passenger" : triggeredByUser?.id === driver.id ? "driver" : "unknown"}
                    {triggeredByUser ? ` (${triggeredByUser.name || triggeredByUser.phone})` : ""} at {alert.createdAt.toLocaleString()}
                    {" · "}
                    <a href={mapsUrl} target="_blank" rel="noreferrer" style={{ color: "#0C447C" }}>view location</a>
                  </div>
                  <div style={{ fontSize: 12, color: "#888780", marginTop: 4 }}>
                    {resolvedContacts.length === 0 ? (
                      "No emergency contacts notified"
                    ) : (
                      <>
                        Notified: {resolvedContacts.map((c) => `${c.name} (${c.phone}${c.relation ? `, ${c.relation}` : ""})`).join(" · ")}
                      </>
                    )}
                  </div>
                </div>
                {alert.status !== "RESOLVED" && (
                  <div style={{ display: "flex", gap: 8 }}>
                    {alert.status === "OPEN" && (
                      <form action={acknowledgeAlert}>
                        <input type="hidden" name="alertId" value={alert.id} />
                        <SubmitButton className="admin-btn admin-btn-secondary" pendingLabel="Updating...">
                          Acknowledge
                        </SubmitButton>
                      </form>
                    )}
                    <ConfirmButton
                      action={resolveAlert}
                      hiddenFields={{ alertId: alert.id }}
                      label="Mark resolved"
                      confirmTitle="Mark this SOS alert resolved?"
                      confirmMessage={`This closes out the alert for booking ${alert.bookingId} — make sure whoever triggered it is actually confirmed safe first, not just that contacts were notified.`}
                      confirmLabel="Mark resolved"
                      className="admin-btn admin-btn-primary"
                    />
                  </div>
                )}
              </div>
            );
          })}
          {alerts.length === 0 && (
            <EmptyState title="No SOS alerts recorded" />
          )}
        </div>
        <Pagination page={page} totalPages={totalPages} basePath="/sos-alerts" />
      </div>
    </AdminShell>
  );
}
