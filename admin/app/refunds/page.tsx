import { prisma } from "../../lib/prisma";
import { getSession, requireRole } from "../../lib/session";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import AdminShell from "../../components/AdminShell";
import { PageHeader } from "../../components/PageHeader";
import { Badge } from "../../components/Badge";
import { RotateCcw } from "lucide-react";
import { EmptyState } from "../../components/EmptyState";
import Pagination from "../../components/Pagination";
import { SubmitButton } from "../../components/SubmitButton";
import { ConfirmButton } from "../../components/ConfirmButton";
import { redirectWithToast } from "../../lib/toastRedirect";
import { isRedirectError } from "../../lib/actionError";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;

async function markProcessing(formData: FormData) {
  "use server";
  const id = formData.get("refundId") as string;
  try {
    await prisma.refund.update({ where: { id }, data: { status: "PROCESSING" } });
    revalidatePath("/refunds");
    redirectWithToast("/refunds", "Marked as processing.");
  } catch (err) {
    if (isRedirectError(err)) throw err;
    redirectWithToast("/refunds", "Couldn't update refund. Try again.", "error");
  }
}

async function markCompleted(formData: FormData) {
  "use server";
  const id = formData.get("refundId") as string;
  try {
    await prisma.refund.update({
      where: { id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    revalidatePath("/refunds");
    redirectWithToast("/refunds", "Refund marked completed.");
  } catch (err) {
    if (isRedirectError(err)) throw err;
    redirectWithToast("/refunds", "Couldn't update refund. Try again.", "error");
  }
}

function refundTone(status: string): "success" | "info" | "danger" | "warning" {
  if (status === "COMPLETED") return "success";
  if (status === "PROCESSING") return "info";
  if (status === "FAILED") return "danger";
  return "warning"; // INITIATED
}

export default async function RefundsPage({ searchParams }: { searchParams: { page?: string } }) {
  const session = getSession();
  if (!requireRole(session, ["finance"])) {
    redirect("/login");
  }

  const page = Math.max(1, Number(searchParams.page || 1));
  const where = { status: { not: "COMPLETED" } };

  const [refunds, total] = await Promise.all([
    prisma.refund.findMany({
      where,
      include: { booking: { include: { passenger: { select: { name: true, phone: true } } } } },
      orderBy: { initiatedAt: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.refund.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <AdminShell activeHref="/refunds">
      <div style={{ padding: 24 }}>
        <PageHeader icon={RotateCcw} title="Refunds" subtitle={`${total} open`} />
        <p style={{ fontSize: 13, color: "#5F5E5A" }}>
          Every refund promises the passenger a 3-working-day completion
          estimate — flagged in red if that window has already passed.
        </p>

        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          {refunds.map((refund) => {
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
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Badge tone={refundTone(refund.status)}>{refund.status}</Badge>
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
                      <SubmitButton className="admin-btn admin-btn-secondary" pendingLabel="Updating...">
                        Mark processing
                      </SubmitButton>
                    </form>
                  )}
                  <ConfirmButton
                    action={markCompleted}
                    hiddenFields={{ refundId: refund.id }}
                    label="Mark completed"
                    confirmTitle="Mark this refund completed?"
                    confirmMessage={`This records Rs ${Number(refund.amount)} as returned to ${refund.booking.passenger.name || refund.booking.passenger.phone} — only confirm once the money has actually gone through on Razorpay's side, not just that it was initiated.`}
                    confirmLabel="Mark completed"
                    className="admin-btn admin-btn-primary"
                  />
                </div>
              </div>
            );
          })}
          {refunds.length === 0 && <EmptyState title="No open refunds" />}
        </div>
        <Pagination page={page} totalPages={totalPages} basePath="/refunds" />
      </div>
    </AdminShell>
  );
}
