import { prisma } from "../../../lib/prisma";
import { getSession, requireRole } from "../../../lib/session";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import AdminShell from "../../../components/AdminShell";
import { EmptyState } from "../../../components/EmptyState";

export const dynamic = "force-dynamic";

async function unflag(formData: FormData) {
  "use server";
  const id = formData.get("reviewId") as string;
  await prisma.review.update({ where: { id }, data: { flagged: false } });
  revalidatePath("/reviews/flagged");
}

async function removeReview(formData: FormData) {
  "use server";
  const id = formData.get("reviewId") as string;
  await prisma.review.delete({ where: { id } });
  revalidatePath("/reviews/flagged");
}

export default async function FlaggedReviewsPage() {
  const session = getSession();
  if (!requireRole(session, ["support"])) {
    redirect("/login");
  }

  const flagged = await prisma.review.findMany({
    where: { flagged: true },
    include: {
      fromUser: { select: { name: true, phone: true } },
      toUser: { select: { name: true, phone: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <AdminShell activeHref="/reviews/flagged">
      <div style={{ padding: 24, fontFamily: "sans-serif" }}>
        <h1 style={{ fontSize: 20, fontWeight: 500 }}>Flagged reviews</h1>
        <p style={{ fontSize: 13, color: "#5F5E5A" }}>
          Reviews are flagged automatically by a future content filter, or
          manually by support staff. This queue handles either path.
        </p>

        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          {flagged.map((r) => (
            <div key={r.id} style={{ border: "1px solid #E3E1D8", borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 13 }}>
                {r.fromUser.name || r.fromUser.phone} rated {r.toUser.name || r.toUser.phone}{" "}
                <span style={{ color: "#854F0B" }}>{r.rating}/5</span>
              </div>
              {r.comment && (
                <div style={{ fontSize: 13, color: "#5F5E5A", marginTop: 4, fontStyle: "italic" }}>
                  "{r.comment}"
                </div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <form action={unflag}>
                  <input type="hidden" name="reviewId" value={r.id} />
                  <button type="submit" style={{ background: "#fff", border: "1px solid #E3E1D8", borderRadius: 6, padding: "6px 12px", fontSize: 12 }}>
                    Keep (unflag)
                  </button>
                </form>
                <form action={removeReview}>
                  <input type="hidden" name="reviewId" value={r.id} />
                  <button type="submit" style={{ background: "#A32D2D", color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 12 }}>
                    Remove
                  </button>
                </form>
              </div>
            </div>
          ))}
          {flagged.length === 0 && <EmptyState title="Nothing flagged" />}
        </div>
      </div>
    </AdminShell>
  );
}
