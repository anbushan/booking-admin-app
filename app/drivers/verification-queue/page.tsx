import { prisma } from "../../../lib/prisma";
import { getSession, requireRole } from "../../../lib/session";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import AdminShell from "../../../components/AdminShell";
import { getDocumentViewUrl } from "../../../lib/r2";
import { EmptyState } from "../../../components/EmptyState";

export const dynamic = "force-dynamic";

async function approveDocument(formData: FormData) {
  "use server";
  const docId = formData.get("docId") as string;
  await prisma.document.update({
    where: { id: docId },
    data: { status: "APPROVED", reviewedAt: new Date() },
  });
  revalidatePath("/drivers/verification-queue");
}

async function rejectDocument(formData: FormData) {
  "use server";
  const docId = formData.get("docId") as string;
  await prisma.document.update({
    where: { id: docId },
    data: { status: "REJECTED", reviewedAt: new Date() },
  });
  revalidatePath("/drivers/verification-queue");
}

export default async function VerificationQueuePage() {
  const session = getSession();
  // Only Verification role (or super_admin) can touch driver documents —
  // Finance and Support are explicitly excluded here.
  if (!requireRole(session, ["verification"])) {
    redirect("/login");
  }

  const pendingDocs = await prisma.document.findMany({
    where: { status: "PENDING" },
    include: { user: { select: { name: true, phone: true } } },
    orderBy: { uploadedAt: "asc" },
  });

  // Generate a fresh signed view URL for each doc up front — short-lived
  // (5 min), never stored or cached beyond this render.
  const docsWithViewUrls = await Promise.all(
    pendingDocs.map(async (doc) => ({
      ...doc,
      viewUrl: await getDocumentViewUrl(doc.r2Key).catch(() => null),
    }))
  );

  return (
    <AdminShell activeHref="/drivers/verification-queue">
    <div style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 20, fontWeight: 500 }}>Driver verification queue</h1>
      <p style={{ fontSize: 13, color: "#5F5E5A" }}>
        {pendingDocs.length} document(s) awaiting review.
      </p>

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
            }}
          >
            <div>
              <div style={{ fontWeight: 500, fontSize: 14 }}>
                {doc.user.name || doc.user.phone} — {doc.docType}
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
                  Approve
                </button>
              </form>
              <form action={rejectDocument}>
                <input type="hidden" name="docId" value={doc.id} />
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
                  Reject
                </button>
              </form>
            </div>
          </div>
        ))}
        {pendingDocs.length === 0 && (
          <EmptyState title="Nothing pending review" />
        )}
      </div>
    </div>
    </AdminShell>
  );
}
