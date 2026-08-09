import { prisma } from "../../../lib/prisma";
import { getSession, requireRole } from "../../../lib/session";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import AdminShell from "../../../components/AdminShell";
import { PageHeader } from "../../../components/PageHeader";
import { Flag } from "lucide-react";
import { EmptyState } from "../../../components/EmptyState";
import Pagination from "../../../components/Pagination";
import { SubmitButton } from "../../../components/SubmitButton";
import { ConfirmButton } from "../../../components/ConfirmButton";
import { redirectWithToast } from "../../../lib/toastRedirect";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;

async function unflag(formData: FormData) {
  "use server";
  const id = formData.get("reviewId") as string;
  await prisma.review.update({ where: { id }, data: { flagged: false } });
  revalidatePath("/reviews/flagged");
  redirectWithToast("/reviews/flagged", "Review kept — unflagged.");
}

async function removeReview(formData: FormData) {
  "use server";
  const id = formData.get("reviewId") as string;
  await prisma.review.delete({ where: { id } });
  revalidatePath("/reviews/flagged");
  redirectWithToast("/reviews/flagged", "Review removed.");
}

export default async function FlaggedReviewsPage({ searchParams }: { searchParams: { page?: string } }) {
  const session = getSession();
  if (!requireRole(session, ["support"])) {
    redirect("/login");
  }

  const page = Math.max(1, Number(searchParams.page || 1));

  const [flagged, total] = await Promise.all([
    prisma.review.findMany({
      where: { flagged: true },
      include: {
        fromUser: { select: { name: true, phone: true } },
        toUser: { select: { name: true, phone: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.review.count({ where: { flagged: true } }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <AdminShell activeHref="/reviews/flagged">
      <div style={{ padding: 24 }}>
        <PageHeader icon={Flag} title="Flagged reviews" subtitle={`${total} total`} />
        <p style={{ fontSize: 13, color: "#5F5E5A" }}>
          Reviews are flagged automatically by a future content filter, or
          manually by support staff. This queue handles either path.
        </p>

        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          {flagged.map((r) => (
            <div key={r.id} style={{ border: "1px solid #E3E1D8", borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span>{r.fromUser.name || r.fromUser.phone} rated {r.toUser.name || r.toUser.phone}</span>
                <span style={{ color: "#D97F0A", letterSpacing: 1 }}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
              </div>
              {r.comment && (
                <div style={{ fontSize: 13, color: "#5F5E5A", marginTop: 4, fontStyle: "italic" }}>
                  "{r.comment}"
                </div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <form action={unflag}>
                  <input type="hidden" name="reviewId" value={r.id} />
                  <SubmitButton className="admin-btn admin-btn-secondary admin-btn-sm" pendingLabel="Keeping...">
                    Keep (unflag)
                  </SubmitButton>
                </form>
                <ConfirmButton
                  action={removeReview}
                  hiddenFields={{ reviewId: r.id }}
                  label="Remove"
                  className="admin-btn admin-btn-danger admin-btn-sm"
                  confirmTitle="Remove this review?"
                  confirmMessage="This permanently deletes the review. This can't be undone."
                  confirmLabel="Delete"
                />
              </div>
            </div>
          ))}
          {flagged.length === 0 && <EmptyState title="Nothing flagged" />}
        </div>
        <Pagination page={page} totalPages={totalPages} basePath="/reviews/flagged" />
      </div>
    </AdminShell>
  );
}
