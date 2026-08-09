import { prisma } from "../../lib/prisma";
import { getSession, requireRole } from "../../lib/session";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import AdminShell from "../../components/AdminShell";
import { PageHeader } from "../../components/PageHeader";
import { Badge } from "../../components/Badge";
import { Star } from "lucide-react";
import { EmptyState } from "../../components/EmptyState";
import { SearchFilterBar } from "../../components/SearchFilterBar";
import Pagination from "../../components/Pagination";
import { SubmitButton } from "../../components/SubmitButton";
import { redirectWithToast } from "../../lib/toastRedirect";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;
const SORTS: Record<string, any> = {
  newest: { createdAt: "desc" },
  oldest: { createdAt: "asc" },
  highest: { rating: "desc" },
  lowest: { rating: "asc" },
};

async function flagReview(formData: FormData) {
  "use server";
  const id = formData.get("reviewId") as string;
  await prisma.review.update({ where: { id }, data: { flagged: true } });
  revalidatePath("/reviews");
  redirectWithToast("/reviews", "Review flagged.");
}

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: { page?: string; q?: string; rating?: string; sort?: string };
}) {
  const session = getSession();
  if (!requireRole(session, ["support"])) {
    redirect("/login");
  }

  const page = Math.max(1, Number(searchParams.page || 1));
  const { q, rating, sort } = searchParams;

  const where = {
    ...(rating ? { rating: Number(rating) } : {}),
    ...(q
      ? {
          OR: [
            { fromUser: { name: { contains: q, mode: "insensitive" as const } } },
            { toUser: { name: { contains: q, mode: "insensitive" as const } } },
            { comment: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where,
      include: {
        fromUser: { select: { name: true, phone: true } },
        toUser: { select: { name: true, phone: true } },
      },
      orderBy: SORTS[sort || "newest"] || SORTS.newest,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.review.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <AdminShell activeHref="/reviews">
      <div style={{ padding: 24 }}>
        <PageHeader icon={Star} title="All reviews" subtitle={`${total} total`} />
        <p style={{ fontSize: 13, color: "#5F5E5A" }}>
          Flag anything that looks abusive or fake — it moves to the
          Flagged Reviews queue for a keep/remove decision.
        </p>

        <SearchFilterBar
          basePath="/reviews"
          q={q}
          searchPlaceholder="Search names or comment..."
          filters={[{ name: "rating", label: "All ratings", value: rating, options: [5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${n} star${n === 1 ? "" : "s"}` })) }]}
          sortOptions={[
            { value: "newest", label: "Newest first" },
            { value: "oldest", label: "Oldest first" },
            { value: "highest", label: "Highest rated" },
            { value: "lowest", label: "Lowest rated" },
          ]}
          sortValue={sort}
        />

        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          {reviews.map((r) => (
            <div key={r.id} style={{ border: "1px solid #E3E1D8", borderRadius: 8, padding: 16, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span>{r.fromUser.name || r.fromUser.phone} rated {r.toUser.name || r.toUser.phone}</span>
                  <span style={{ color: "#D97F0A", letterSpacing: 1 }}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                  {r.flagged && <Badge tone="danger">Flagged</Badge>}
                </div>
                {r.comment && (
                  <div style={{ fontSize: 13, color: "#5F5E5A", marginTop: 4, fontStyle: "italic" }}>"{r.comment}"</div>
                )}
              </div>
              {!r.flagged && (
                <form action={flagReview}>
                  <input type="hidden" name="reviewId" value={r.id} />
                  <SubmitButton className="admin-btn admin-btn-secondary admin-btn-sm" pendingLabel="Flagging...">
                    Flag
                  </SubmitButton>
                </form>
              )}
            </div>
          ))}
          {reviews.length === 0 && <EmptyState title="No reviews match" />}
        </div>

        <Pagination page={page} totalPages={totalPages} basePath="/reviews" extraParams={{ q, rating, sort }} />
      </div>
    </AdminShell>
  );
}
