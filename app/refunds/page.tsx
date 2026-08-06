import { prisma } from "../../lib/prisma";
import { getSession, requireRole } from "../../lib/session";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import AdminShell from "../../components/AdminShell";
import { EmptyState } from "../../components/EmptyState";

export const dynamic = "force-dynamic";

async function markProcessing(formData: FormData) {
  "use server";
  const id = formData.get("refundId") as string;
  await prisma.refund.update({ where: { id }, data: { status: "PROCESSING" } });
  revalidatePath("/refunds");
}

async function markCompleted(formData: FormData) {
  "use server";
  const id = formData.get("refundId") as string;
  await prisma.refund.update({
    where: { id },
    data: { status: "COMPLETED", completedAt: new Date() },
  });
  revalidatePath("/refunds");
}

function statusColor(status: string) {
  if (status === "COMPLETED") return { bg: "#EAF3DE", text: "#3B6D11" };
  if (status === "PROCESSING") return { bg: "#E6F1FB", text: "#0C447C" };
  if (status === "FAILED") return { bg: "#FCEBEB", text: "#A32D2D" };
  return { bg: "#FAEEDA", text: "#854F0B" }; // INITIATED
}

export default async function RefundsPage() {
  const session = getSession();
  if (!requireRole(session, ["finance"])) {
    redirect("/login");
  }

  const refunds = await prisma.refund.findMany({
    where: { status: { not: "COMPLETED" } },
    include: { booking: { include: { passenger: { select: { name: true, phone: true } } } } },
    orderBy: { initiatedAt: "asc" },
  });

  return (
    <AdminShell activeHref="/refunds">
      <div style={{ padding: 24, fontFamily: "sans-serif" }}>
        <h1 style={{ fontSize: 20, fontWeight: 500 }}>Refunds</h1>
        <p style={{ fontSize: 13, color: "#5F5E5A" }}>
          Every refund promises the passenger a 3-working-day completion
          estimate — flagged in red if that window has already passed.
        </p>

        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          {refunds.map((refund) => {
            const colors = statusColor(refund.status);
            const overdue = new Date() > refund.estimatedCompletionAt;
            return (
              <div
                key={refund.id}
                style={{
                  border: overdue ? "1px solid #E24B4A" : "1px solid #E3E1D8",
                  borderRadius: 8,
                  padding: 16,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, background: colors.bg, color: colors.text, padding: "2px 8px", borderRadius: 6 }}>
                      {refund.status}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>
                      Rs {Number(refund.amount)} — {refund.booking.passenger.name || refund.booking.passenger.phone}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: overdue ? "#A32D2D" : "#888780", marginTop: 4 }}>
                    Initiated {refund.initiatedAt.toLocaleDateString()} · estimated by{" "}
                    {refund.estimatedCompletionAt.toLocaleDateString()}
                    {overdue && " — overdue"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {refund.status === "INITIATED" && (
                    <form action={markProcessing}>
                      <input type="hidden" name="refundId" value={refund.id} />
                      <button type="submit" style={{ background: "#fff", border: "1px solid #E3E1D8", borderRadius: 6, padding: "8px 14px", fontSize: 13 }}>
                        Mark processing
                      </button>
                    </form>
                  )}
                  <form action={markCompleted}>
                    <input type="hidden" name="refundId" value={refund.id} />
                    <button type="submit" style={{ background: "#1A1A18", color: "#fff", border: "none", borderRadius: 6, padding: "8px 14px", fontSize: 13 }}>
                      Mark completed
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
          {refunds.length === 0 && <EmptyState title="No open refunds" />}
        </div>
      </div>
    </AdminShell>
  );
}
