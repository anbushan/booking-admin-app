import { prisma } from "../../../lib/prisma";
import { getSession, requireRole } from "../../../lib/session";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import AdminShell from "../../../components/AdminShell";
import { PageHeader } from "../../../components/PageHeader";
import { EmptyState } from "../../../components/EmptyState";
import Pagination from "../../../components/Pagination";
import { SubmitButton } from "../../../components/SubmitButton";
import { redirectWithToast } from "../../../lib/toastRedirect";
import { isRedirectError } from "../../../lib/actionError";
import { UserX } from "lucide-react";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;

// Requests submitted from the public /delete-account page (someone who
// wants their data gone but doesn't have the app installed to use the
// in-app DeleteAccountScreen flow) — see AccountDeletionRequest's own
// schema comment. Marking one "processed" here doesn't delete anything
// by itself; it's a checklist for whoever actually calls the number
// back / verifies the requester and runs the real deletion.
async function markProcessed(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  const session = getSession();
  try {
    await prisma.accountDeletionRequest.update({
      where: { id },
      data: { processedAt: new Date(), processedBy: session?.adminId },
    });
    revalidatePath("/users/deletion-requests");
    redirectWithToast("/users/deletion-requests", "Marked processed.");
  } catch (err) {
    if (isRedirectError(err)) throw err;
    redirectWithToast("/users/deletion-requests", "Couldn't update. Try again.", "error");
  }
}

export default async function DeletionRequestsPage({ searchParams }: { searchParams: { page?: string } }) {
  const session = getSession();
  if (!requireRole(session, ["support"])) {
    redirect("/login");
  }

  const page = Math.max(1, Number(searchParams.page || 1));
  const where = { processedAt: null };

  const [requests, total, pendingCount] = await Promise.all([
    prisma.accountDeletionRequest.findMany({
      orderBy: { createdAt: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.accountDeletionRequest.count(),
    prisma.accountDeletionRequest.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <AdminShell activeHref="/users/deletion-requests">
      <div style={{ padding: 24 }}>
        <PageHeader icon={UserX} title="Deletion requests" subtitle={`${pendingCount} pending · ${total} total`} />
        <p style={{ fontSize: 13, color: "#5F5E5A", marginTop: -8, marginBottom: 16, maxWidth: 620 }}>
          Submitted from the public delete-account page, not the app itself — verify the requester (call the number back) before running the real deletion from their account in Users.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {requests.map((r) => (
            <div key={r.id} style={{ border: "1px solid #E3E1D8", borderRadius: 8, padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{r.phone}</div>
                {r.reason && <div style={{ fontSize: 12, color: "#5F5E5A", marginTop: 2 }}>{r.reason}</div>}
                <div style={{ fontSize: 12, color: "#888780", marginTop: 4 }}>
                  Requested {r.createdAt.toLocaleString()}
                  {r.processedAt && ` · processed ${r.processedAt.toLocaleString()}`}
                </div>
              </div>
              {!r.processedAt && (
                <form action={markProcessed}>
                  <input type="hidden" name="id" value={r.id} />
                  <SubmitButton className="admin-btn admin-btn-secondary admin-btn-sm" pendingLabel="Saving...">
                    Mark processed
                  </SubmitButton>
                </form>
              )}
            </div>
          ))}
          {requests.length === 0 && <EmptyState title="No deletion requests" />}
        </div>
        <Pagination page={page} totalPages={totalPages} basePath="/users/deletion-requests" />
      </div>
    </AdminShell>
  );
}
