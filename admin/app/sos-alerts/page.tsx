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
import { redirectWithToast } from "../../lib/toastRedirect";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;

async function acknowledgeAlert(formData: FormData) {
  "use server";
  const alertId = formData.get("alertId") as string;
  await prisma.sosAlert.update({ where: { id: alertId }, data: { status: "ACKNOWLEDGED" } });
  revalidatePath("/sos-alerts");
  redirectWithToast("/sos-alerts", "Alert acknowledged.");
}

async function resolveAlert(formData: FormData) {
  "use server";
  const alertId = formData.get("alertId") as string;
  await prisma.sosAlert.update({ where: { id: alertId }, data: { status: "RESOLVED" } });
  revalidatePath("/sos-alerts");
  redirectWithToast("/sos-alerts", "Alert resolved.");
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

  return (
    <AdminShell activeHref="/sos-alerts">
      <div style={{ padding: 24 }}>
        <PageHeader icon={AlertTriangle} title="SOS alerts" subtitle={`${openCount} open alert(s) · ${total} total`} />

        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          {alerts.map((alert) => {
            return (
              <div
                key={alert.id}
                style={{
                  border: "1px solid #E3E1D8",
                  borderRadius: 8,
                  padding: 16,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Badge tone={sosTone(alert.status)}>{alert.status}</Badge>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>Booking {alert.bookingId}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#888780", marginTop: 4 }}>
                    Triggered {alert.createdAt.toLocaleString()} · lat {alert.lat.toFixed(4)}, lng{" "}
                    {alert.lng.toFixed(4)} · {alert.contactedIds.length} contact(s) notified
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
                    <form action={resolveAlert}>
                      <input type="hidden" name="alertId" value={alert.id} />
                      <SubmitButton pendingLabel="Updating...">Mark resolved</SubmitButton>
                    </form>
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
