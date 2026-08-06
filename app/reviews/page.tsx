import { prisma } from "../../lib/prisma";
import { getSession, requireRole } from "../../lib/session";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import AdminShell from "../../components/AdminShell";
import { EmptyState } from "../../components/EmptyState";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;

async function flagReview(formData: FormData) {
  "use server";
  const id = formData.get("reviewId") as string;
  await prisma.review.update({ where: { id }, data: { flagged: true } });
  revalidatePath("/reviews");
}

export default async function ReviewsPage({ searchParams }: { searchParams: { page?: string } }) {
  const session = getSession();
  if (!requireRole(session, ["support"])) {
    redirect("/login");
  }

  const page = Math.max(1, Number(searchParams.page || 1));

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      include: {
        fromUser: { select: { name: true, phone: true } },
        toUser: { select: { name: true, phone: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.review.count(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <AdminShell activeHref="/reviews">
      <div style={{ padding: 24, fontFamily: "sans-serif" }}>
        <h1 style={{ fontSize: 20, fontWeight: 500 }}>All reviews</h1>
        <p style={{ fontSize: 13, color: "#5F5E5A" }}>
          Flag anything that looks abusive or fake — it moves to the
          Flagged Reviews queue for a keep/remove decision.
        </p>

        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          {reviews.map((r) => (
            <div key={r.id} style={{ border: "1px solid #E3E1D8", borderRadius: 8, padding: 16, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 13 }}>
                  {r.fromUser.name || r.fromUser.phone} rated {r.toUser.name || r.toUser.phone}{" "}
                  <span style={{ color: "#854F0B" }}>{r.rating}/5</span>
                  {r.flagged && <span style={{ marginLeft: 8, fontSize: 11, background: "#FCEBEB", color: "#A32D2D", padding: "2px 6px", borderRadius: 4 }}>Flagged</span>}
                </div>
                {r.comment && (
                  <div style={{ fontSize: 13, color: "#5F5E5A", marginTop: 4, fontStyle: "italic" }}>"{r.comment}"</div>
                )}
              </div>
              {!r.flagged && (
                <form action={flagReview}>
                  <input type="hidden" name="reviewId" value={r.id} />
                  <button type="submit" style={{ background: "#fff", border: "1px solid #E3E1D8", borderRadius: 6, padding: "6px 12px", fontSize: 12 }}>
                    Flag
                  </button>
                </form>
              )}
            </div>
          ))}
          {reviews.length === 0 && <EmptyState title="No reviews yet" />}
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 16, fontSize: 13 }}>
          {page > 1 && <a href={`/reviews?page=${page - 1}`} style={{ color: "#0C447C" }}>Previous</a>}
          <span style={{ color: "#888780" }}>Page {page} of {totalPages}</span>
          {page < totalPages && <a href={`/reviews?page=${page + 1}`} style={{ color: "#0C447C" }}>Next</a>}
        </div>
      </div>
    </AdminShell>
  );
}
