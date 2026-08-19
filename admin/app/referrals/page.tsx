import { prisma } from "../../lib/prisma";
import { getSession, requireRole } from "../../lib/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import AdminShell from "../../components/AdminShell";
import { PageHeader } from "../../components/PageHeader";
import { Badge } from "../../components/Badge";
import { StatCard } from "../../components/StatCard";
import { EmptyState } from "../../components/EmptyState";
import Pagination from "../../components/Pagination";
import { Share2, Users, IndianRupee, CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;

// Read-only visibility into the refer-a-friend program (see backend's
// src/routes/referrals.routes.js + lib/credits.js). A referral only
// completes — referrer credited — once the referee's platform fee is
// actually paid, not on redemption alone; the status badge below
// reflects that, not just "code was entered".
export default async function ReferralsPage({ searchParams }: { searchParams: { page?: string } }) {
  const session = getSession();
  if (!requireRole(session, ["finance"])) {
    redirect("/login");
  }

  const page = Math.max(1, Number(searchParams.page || 1));

  const [referrals, total, completedCount, creditAgg] = await Promise.all([
    prisma.referral.findMany({
      include: {
        referrer: { select: { id: true, name: true, phone: true } },
        referee: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.referral.count(),
    prisma.referral.count({ where: { status: "COMPLETED" } }),
    prisma.userCredit.aggregate({
      where: { source: { in: ["REFERRAL_REFERRER", "REFERRAL_REFEREE"] } },
      _sum: { amountInr: true },
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <AdminShell activeHref="/referrals">
      <div style={{ padding: 24 }}>
        <PageHeader
          icon={Share2}
          title="Referrals"
          subtitle="Refer-a-friend program — read-only. Codes/rewards are managed under Settings → App config."
        />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
          <StatCard icon={Users} label="Total referrals" value={total} tone="accent" />
          <StatCard icon={CheckCircle2} label="Completed (referrer paid out)" value={completedCount} tone="success" />
          <StatCard icon={IndianRupee} label="Total credit issued" value={`Rs ${Number(creditAgg._sum.amountInr || 0)}`} tone="neutral" />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {referrals.map((r) => (
            <div key={r.id} style={{ border: "1px solid #E3E1D8", borderRadius: 8, padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ fontSize: 14 }}>
                  <Link href={`/users/${r.referrer.id}`} style={{ color: "#0C447C", fontWeight: 500 }}>{r.referrer.name || r.referrer.phone}</Link>
                  {" referred "}
                  <Link href={`/users/${r.referee.id}`} style={{ color: "#0C447C", fontWeight: 500 }}>{r.referee.name || r.referee.phone}</Link>
                </div>
                <div style={{ fontSize: 12, color: "#888780", marginTop: 4 }}>
                  Redeemed {r.createdAt.toLocaleDateString()}
                  {r.completedAt && ` · referrer paid out ${r.completedAt.toLocaleDateString()}`}
                </div>
              </div>
              <Badge tone={r.status === "COMPLETED" ? "success" : "warning"}>
                {r.status === "COMPLETED" ? "Completed" : "Awaiting referee's first paid ride"}
              </Badge>
            </div>
          ))}
          {referrals.length === 0 && <EmptyState title="No referrals yet" subtitle="They'll show up here as soon as someone redeems a friend's code." />}
        </div>
        <Pagination page={page} totalPages={totalPages} basePath="/referrals" />
      </div>
    </AdminShell>
  );
}
