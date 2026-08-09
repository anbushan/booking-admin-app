import { prisma } from "../../../lib/prisma";
import { getSession, requireRole } from "../../../lib/session";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import AdminShell from "../../../components/AdminShell";
import { PageHeader } from "../../../components/PageHeader";
import { Badge } from "../../../components/Badge";
import { ShieldCheck } from "lucide-react";
import { getDocumentViewUrl } from "../../../lib/r2";
import { EmptyState } from "../../../components/EmptyState";
import Pagination from "../../../components/Pagination";
import { SubmitButton } from "../../../components/SubmitButton";
import { ConfirmButton } from "../../../components/ConfirmButton";
import { redirectWithToast } from "../../../lib/toastRedirect";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 20;

async function approveDocument(formData: FormData) {
  "use server";
  const docId = formData.get("docId") as string;
  await prisma.document.update({
    where: { id: docId },
    data: { status: "APPROVED", reviewedAt: new Date() },
  });
  revalidatePath("/drivers/verification-queue");
  redirectWithToast("/drivers/verification-queue", "Document approved.");
}

async function rejectDocument(formData: FormData) {
  "use server";
  const docId = formData.get("docId") as string;
  await prisma.document.update({
    where: { id: docId },
    data: { status: "REJECTED", reviewedAt: new Date() },
  });
  revalidatePath("/drivers/verification-queue");
  redirectWithToast("/drivers/verification-queue", "Document rejected.");
}

export default async function VerificationQueuePage({ searchParams }: { searchParams: { page?: string } }) {
  const session = getSession();
  // Only Verification role (or super_admin) can touch driver documents —
  // Finance and Support are explicitly excluded here.
  if (!requireRole(session, ["verification"])) {
    redirect("/login");
  }

  const page = Math.max(1, Number(searchParams.page || 1));
  const where = { status: "PENDING" };

  const [pendingDocs, total] = await Promise.all([
    prisma.document.findMany({
      where,
      include: { user: { select: { name: true, phone: true } } },
      orderBy: { uploadedAt: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.document.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Generate a fresh signed view URL for each doc on this page only —
  // short-lived (5 min), never stored or cached beyond this render.
  // Paginating this query is what keeps this cheap: before, this fired
  // one signed-URL request per *every* pending document in the whole
  // queue on every single render, unbounded.
  const docsWithViewUrls = await Promise.all(
    pendingDocs.map(async (doc) => ({
      ...doc,
      viewUrl: await getDocumentViewUrl(doc.r2Key).catch(() => null),
    }))
  );

  return (
    <AdminShell activeHref="/drivers/verification-queue">
    <div style={{ padding: 24 }}>
      <PageHeader icon={ShieldCheck} title="Driver verification queue" subtitle={`${total} document(s) awaiting review`} />

      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {docsWithViewUrls.map((doc) => (
          <div
            key={doc.id}
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
              <div style={{ fontWeight: 500, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                <span>{doc.user.name || doc.user.phone}</span>
                <Badge tone="neutral">{doc.docType}</Badge>
              </div>
              <div style={{ fontSize: 12, color: "#888780" }}>
                Uploaded {doc.uploadedAt.toLocaleDateString()}
              </div>
              {/* In production, fetch a fresh short-lived signed R2 view URL
                  here on each render rather than storing a long-lived link. */}
              {doc.viewUrl && (
                <a
                  href={doc.viewUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 12, color: "#0C447C" }}
                >
                  View document (link expires in 5 min)
                </a>
              )}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <form action={approveDocument}>
                <input type="hidden" name="docId" value={doc.id} />
                <SubmitButton pendingLabel="Approving...">Approve</SubmitButton>
              </form>
              <ConfirmButton
                action={rejectDocument}
                hiddenFields={{ docId: doc.id }}
                label="Reject"
                className="admin-btn admin-btn-secondary"
                confirmTitle="Reject this document?"
                confirmMessage={`${doc.user.name || doc.user.phone}'s ${doc.docType} will be marked rejected — they'll need to re-upload.`}
                confirmLabel="Reject"
              />
            </div>
          </div>
        ))}
        {pendingDocs.length === 0 && (
          <EmptyState title="Nothing pending review" />
        )}
      </div>
      <Pagination page={page} totalPages={totalPages} basePath="/drivers/verification-queue" />
    </div>
    </AdminShell>
  );
}
