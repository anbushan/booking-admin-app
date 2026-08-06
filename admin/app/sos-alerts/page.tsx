import { prisma } from "../../lib/prisma";
import { getSession, requireRole } from "../../lib/session";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import AdminShell from "../../components/AdminShell";
import { EmptyState } from "../../components/EmptyState";

export const dynamic = "force-dynamic";

async function acknowledgeAlert(formData: FormData) {
  "use server";
  const alertId = formData.get("alertId") as string;
  await prisma.sosAlert.update({ where: { id: alertId }, data: { status: "ACKNOWLEDGED" } });
  revalidatePath("/sos-alerts");
}

async function resolveAlert(formData: FormData) {
  "use server";
  const alertId = formData.get("alertId") as string;
  await prisma.sosAlert.update({ where: { id: alertId }, data: { status: "RESOLVED" } });
  revalidatePath("/sos-alerts");
}

function statusColor(status: string) {
  if (status === "OPEN") return { bg: "#FCEBEB", text: "#A32D2D" };
  if (status === "ACKNOWLEDGED") return { bg: "#FAEEDA", text: "#854F0B" };
  return { bg: "#EAF3DE", text: "#3B6D11" };
}

export default async function SosAlertsPage() {
  const session = getSession();
  // Support role has SOS visibility per the plan's role table, alongside
  // super_admin.
  if (!requireRole(session, ["support"])) {
    redirect("/login");
  }

  const alerts = await prisma.sosAlert.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <AdminShell activeHref="/sos-alerts">
      <div style={{ padding: 24, fontFamily: "sans-serif" }}>
        <h1 style={{ fontSize: 20, fontWeight: 500 }}>SOS alerts</h1>
        <p style={{ fontSize: 13, color: "#5F5E5A" }}>
          {alerts.filter((a) => a.status === "OPEN").length} open alert(s).
        </p>

        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          {alerts.map((alert) => {
            const colors = statusColor(alert.status);
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
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        fontSize: 11,
                        background: colors.bg,
                        color: colors.text,
                        padding: "2px 8px",
                        borderRadius: 6,
                      }}
                    >
                      {alert.status}
                    </span>
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
                        <button
                          type="submit"
                          style={{
                            background: "#fff",
                            border: "1px solid #E3E1D8",
                            borderRadius: 6,
                            padding: "8px 14px",
                            fontSize: 13,
                          }}
                        >
                          Acknowledge
                        </button>
                      </form>
                    )}
                    <form action={resolveAlert}>
                      <input type="hidden" name="alertId" value={alert.id} />
                      <button
                        type="submit"
                        style={{
                          background: "#1A1A18",
                          color: "#fff",
                          border: "none",
                          borderRadius: 6,
                          padding: "8px 14px",
                          fontSize: 13,
                        }}
                      >
                        Mark resolved
                      </button>
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
      </div>
    </AdminShell>
  );
}
