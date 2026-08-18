import { prisma } from "../../lib/prisma";
import { getSession, requireRole } from "../../lib/session";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import AdminShell from "../../components/AdminShell";
import { PageHeader } from "../../components/PageHeader";
import { Badge } from "../../components/Badge";
import { StatCard } from "../../components/StatCard";
import { SubmitButton } from "../../components/SubmitButton";
import { EmptyState } from "../../components/EmptyState";
import Pagination from "../../components/Pagination";
import { redirectWithToast } from "../../lib/toastRedirect";
import { isRedirectError } from "../../lib/actionError";
import { Gift, Ticket, CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;

async function createPromoCode(formData: FormData) {
  "use server";
  const code = String(formData.get("code") || "").toUpperCase().trim();
  const fullWaiver = formData.get("fullWaiver") === "on";
  const discountInr = Number(formData.get("discountInr"));
  const firstRideOnly = formData.get("firstRideOnly") === "on";
  const maxRedemptionsRaw = String(formData.get("maxRedemptions") || "").trim();
  const maxRedemptions = maxRedemptionsRaw ? Number(maxRedemptionsRaw) : null;
  const expiresAtRaw = String(formData.get("expiresAt") || "").trim();
  const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null;

  try {
    if (!code) {
      redirectWithToast("/promo-codes", "Enter a code.", "error");
      return;
    }
    // Full-waiver codes don't need a discount amount — the whole point
    // is "the entire fee, whatever it is", not a fixed rupee figure —
    // so that field is only required for the normal, partial-discount
    // kind. discountInr still gets written (0) since the column is
    // required; it's simply never read for a fullWaiver code — see
    // lib/credits.js on the backend.
    if (!fullWaiver && (!discountInr || discountInr <= 0)) {
      redirectWithToast("/promo-codes", "Enter a discount amount greater than 0, or check \"Full waiver\".", "error");
      return;
    }
    await prisma.promoCode.create({
      data: { code, discountInr: fullWaiver ? 0 : discountInr, fullWaiver, firstRideOnly, maxRedemptions, expiresAt },
    });
    revalidatePath("/promo-codes");
    redirectWithToast("/promo-codes", `Created code "${code}".`);
  } catch (err: any) {
    if (isRedirectError(err)) throw err;
    const message = err?.code === "P2002" ? `Code "${code}" already exists.` : "Couldn't create the code. Try again.";
    redirectWithToast("/promo-codes", message, "error");
  }
}

async function toggleActive(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  const nextActive = formData.get("nextActive") === "true";
  try {
    const promo = await prisma.promoCode.update({ where: { id }, data: { active: nextActive } });
    revalidatePath("/promo-codes");
    redirectWithToast("/promo-codes", `"${promo.code}" ${nextActive ? "activated" : "paused"}.`);
  } catch (err) {
    if (isRedirectError(err)) throw err;
    redirectWithToast("/promo-codes", "Couldn't update the code. Try again.", "error");
  }
}

export default async function PromoCodesPage({ searchParams }: { searchParams: { page?: string } }) {
  const session = getSession();
  if (!requireRole(session, ["finance"])) {
    redirect("/login");
  }

  const page = Math.max(1, Number(searchParams.page || 1));

  // Stats come from their own aggregate/count queries, independent of
  // the paginated list below — otherwise "Codes"/"Active"/"Total
  // redemptions" would silently only reflect whichever page happened
  // to be showing instead of the true totals, the moment this list
  // grew past one page.
  const [codes, totalCodes, activeCount, redemptionAgg] = await Promise.all([
    prisma.promoCode.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.promoCode.count(),
    prisma.promoCode.count({ where: { active: true } }),
    prisma.promoCode.aggregate({ _sum: { redemptionCount: true } }),
  ]);
  const totalRedemptions = redemptionAgg._sum.redemptionCount || 0;
  const totalPages = Math.max(1, Math.ceil(totalCodes / PAGE_SIZE));

  return (
    <AdminShell activeHref="/promo-codes">
      <div style={{ padding: 24 }}>
        <PageHeader
          icon={Gift}
          title="Promo codes"
          subtitle="First-ride discount codes — same credit ledger the referral program feeds into"
        />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
          <StatCard icon={Gift} label="Codes" value={totalCodes} tone="accent" />
          <StatCard icon={CheckCircle2} label="Active" value={activeCount} tone="success" />
          <StatCard icon={Ticket} label="Total redemptions" value={totalRedemptions} tone="neutral" />
        </div>

        <div style={{ border: "1px solid #E3E1D8", borderRadius: 10, padding: 16, marginBottom: 24, maxWidth: 520 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>New code</h2>
          <form action={createPromoCode} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 4 }}>Code</label>
              <input name="code" placeholder="WELCOME50" className="admin-input" style={{ width: "100%", textTransform: "uppercase" }} required />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, background: "#FFF6E5", border: "1px solid #F0DBA0", borderRadius: 6, padding: "8px 10px" }}>
              <input type="checkbox" name="fullWaiver" style={{ width: 16, height: 16 }} />
              Full waiver — makes the platform fee entirely free (MVP launch promos)
            </label>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 4 }}>Discount (Rs)</label>
              <input name="discountInr" type="number" step="any" min="1" placeholder="50" className="admin-input" style={{ width: "100%" }} />
              <div style={{ fontSize: 11, color: "#888780", marginTop: 2 }}>Applied as credit toward the platform fee — same as a referral reward, not the ride fare itself. Ignored if "Full waiver" above is checked.</div>
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 4 }}>Max redemptions (optional)</label>
              <input name="maxRedemptions" type="number" min="1" placeholder="Leave blank for unlimited" className="admin-input" style={{ width: "100%" }} />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 4 }}>Expires on (optional)</label>
              <input name="expiresAt" type="date" className="admin-input" style={{ width: "100%" }} />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 500 }}>
              <input type="checkbox" name="firstRideOnly" defaultChecked style={{ width: 16, height: 16 }} />
              First ride only (blocks anyone with a prior paid booking)
            </label>
            <SubmitButton pendingLabel="Creating...">Create code</SubmitButton>
          </form>
        </div>

        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>All codes</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {codes.map((c) => {
            const maxedOut = c.maxRedemptions != null && c.redemptionCount >= c.maxRedemptions;
            const expired = c.expiresAt != null && c.expiresAt < new Date();
            return (
              <div key={c.id} style={{ border: "1px solid #E3E1D8", borderRadius: 8, padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 14, fontFamily: "monospace", letterSpacing: 1 }}>{c.code}</span>
                    <Badge tone={c.active && !expired && !maxedOut ? "success" : "neutral"}>
                      {!c.active ? "Paused" : expired ? "Expired" : maxedOut ? "Fully claimed" : "Active"}
                    </Badge>
                    {c.fullWaiver && <Badge tone="warning">Full waiver</Badge>}
                    {c.firstRideOnly && <Badge tone="info">First ride only</Badge>}
                  </div>
                  <div style={{ fontSize: 12, color: "#888780", marginTop: 4 }}>
                    {c.fullWaiver ? "Platform fee fully waived" : `Rs ${c.discountInr.toString()} off`} · {c.redemptionCount}{c.maxRedemptions != null ? ` / ${c.maxRedemptions}` : ""} redeemed
                    {c.expiresAt && ` · expires ${c.expiresAt.toLocaleDateString()}`}
                  </div>
                </div>
                <form action={toggleActive}>
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="nextActive" value={String(!c.active)} />
                  <SubmitButton className="admin-btn admin-btn-sm" pendingLabel="...">
                    {c.active ? "Pause" : "Activate"}
                  </SubmitButton>
                </form>
              </div>
            );
          })}
          {codes.length === 0 && <EmptyState title="No promo codes yet" subtitle="Create one above to give first-ride riders a discount." />}
        </div>
        <Pagination page={page} totalPages={totalPages} basePath="/promo-codes" />
      </div>
    </AdminShell>
  );
}
