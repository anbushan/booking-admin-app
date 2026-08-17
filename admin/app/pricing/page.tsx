import type { Metadata } from "next";
import Link from "next/link";
import { Wallet, KeyRound, Car, ShieldCheck, Zap, ClipboardCheck } from "lucide-react";
import { MarketingShell } from "../../components/MarketingShell";
import { FloatingIconCluster } from "../../components/marketing/FloatingIconCluster";
import { SITE_URL, BRAND_NAME } from "../../lib/siteContent";

const TITLE = "Pricing";
const DESCRIPTION = `What ${BRAND_NAME} actually charges — the passenger platform fee, and the two optional driver verification fees. No commissions, no surge pricing, no fine print.`;

export const metadata: Metadata = {
  title: `${TITLE} — ${BRAND_NAME}`,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/pricing` },
  openGraph: { title: `${TITLE} — ${BRAND_NAME}`, description: DESCRIPTION, url: `${SITE_URL}/pricing`, siteName: BRAND_NAME, type: "website" },
};

// Every figure here is an AppConfig default (backend/src/lib/appConfig.js)
// — admin-configurable, not hardcoded in the app itself. Phrased as
// "currently" throughout for the same reason the FAQ does: this page
// shouldn't go stale the moment an admin changes a number.
export default function PricingPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `${TITLE} — ${BRAND_NAME}`,
    url: `${SITE_URL}/pricing`,
    description: DESCRIPTION,
  };

  return (
    <MarketingShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <section className="mkt-section-tight">
        <div className="mkt-hero-with-icons">
          <div>
            <span className="mkt-eyebrow">Pricing</span>
            <h1 className="mkt-h1" style={{ fontSize: "clamp(28px, 4vw, 40px)" }}>What actually gets charged, and when</h1>
            <p className="mkt-lede" style={{ maxWidth: "none" }}>
              Two completely separate things touch money on {BRAND_NAME}: a small platform fee passengers pay
              to lock a seat, and optional verification fees drivers can pay for an instant trust badge. Nothing
              else runs through the app — the rest of every fare is settled directly, in person.
            </p>
          </div>
          <FloatingIconCluster icons={[Wallet, KeyRound, ShieldCheck]} />
        </div>
      </section>

      <section className="mkt-section" id="passengers">
        <span className="mkt-eyebrow">For passengers</span>
        <h2 className="mkt-h2" style={{ marginTop: 12 }}>The platform fee</h2>
        <div className="mkt-grid-2" style={{ marginTop: 20 }}>
          <div className="mkt-card">
            <div className="mkt-card-icon" style={{ background: "#E6F1FB" }}>
              <Wallet size={20} color="#0C447C" />
            </div>
            <h3>Currently 10% of the fare</h3>
            <p>
              Paid once, upfront, the moment a driver accepts your request — that's what locks your seat in.
              It funds matching, safety features, and the app itself. The rest of the fare is a cost-sharing
              contribution settled directly with the driver in cash or UPI once the trip is done, and never
              touches the app.
            </p>
          </div>
          <div className="mkt-card">
            <div className="mkt-card-icon" style={{ background: "#EAF3DE" }}>
              <ShieldCheck size={20} color="#3B6D11" />
            </div>
            <h3>A per-kilometre fare cap</h3>
            <p>
              The rest of the fare — the part you settle directly — is capped per kilometre platform-wide.
              That's what keeps this genuine cost-sharing instead of a taxi fare with extra steps: there's no
              surge pricing, and no driver can quietly turn a shared trip into a commercial one.
            </p>
          </div>
        </div>
        <p style={{ fontSize: 14, color: "#5F5E5A", marginTop: 20, maxWidth: 640 }}>
          If a driver cancels after you've paid, the platform fee is refunded in full automatically — no
          exceptions, no timing rules. See the <Link href="/faq" style={{ color: "#185FA5" }}>FAQ</Link> for
          the complete cancellation and refund policy.
        </p>
      </section>

      <section className="mkt-section" style={{ background: "#FBFAF7" }} id="drivers">
        <span className="mkt-eyebrow">For drivers</span>
        <h2 className="mkt-h2" style={{ marginTop: 12 }}>Verification — optional, and never required to publish</h2>
        <p className="mkt-lede">
          Adding a vehicle and publishing rides costs nothing and needs no documents at all. Verification only
          exists to earn a visible trust badge — two separate ones, since a licence and a vehicle's registration
          are checked independently.
        </p>

        <div className="mkt-grid-2" style={{ marginTop: 24 }}>
          <div className="mkt-card">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div className="mkt-card-icon" style={{ background: "#E6F1FB", marginBottom: 0 }}>
                <KeyRound size={20} color="#0C447C" />
              </div>
              <h3 style={{ margin: 0 }}>Licence check</h3>
            </div>
            <p>Once per driver — covers every vehicle you ever add, then or later.</p>
          </div>
          <div className="mkt-card">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div className="mkt-card-icon" style={{ background: "#E6F1FB", marginBottom: 0 }}>
                <Car size={20} color="#0C447C" />
              </div>
              <h3 style={{ margin: 0 }}>RC check</h3>
            </div>
            <p>Once per vehicle — every vehicle needs its own, since the registration is tied to that car.</p>
          </div>
        </div>

        <p style={{ fontSize: 15, fontWeight: 600, color: "#1A1A18", marginTop: 32, marginBottom: 16 }}>
          Either check, two ways to pass:
        </p>
        <div className="mkt-grid-2">
          <div className="mkt-card">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div className="mkt-card-icon" style={{ background: "#FEF3E0", marginBottom: 0 }}>
                <Zap size={20} color="#B4720A" />
              </div>
              <h3 style={{ margin: 0 }}>Instant, paid</h3>
            </div>
            <p>
              Currently a small fee (a few rupees) per check, charged in-app. Checked automatically the moment
              you pay — you review exactly what came back before it's saved as your official record.
            </p>
          </div>
          <div className="mkt-card">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div className="mkt-card-icon" style={{ background: "#EAF3DE", marginBottom: 0 }}>
                <ClipboardCheck size={20} color="#3B6D11" />
              </div>
              <h3 style={{ margin: 0 }}>Free, manual</h3>
            </div>
            <p>
              Upload your document instead and an admin reviews it by hand — typically within an hour, no
              charge either way. Same badge at the end, just a different path there.
            </p>
          </div>
        </div>

        <p style={{ fontSize: 14, color: "#5F5E5A", marginTop: 20, maxWidth: 640 }}>
          One thing worth knowing: editing a vehicle's registration number resets that vehicle's RC badge —
          the paid check was tied to the exact number that was looked up. Your licence badge is unaffected,
          since it isn't tied to any one vehicle.
        </p>
      </section>

      <section className="mkt-section-tight" style={{ textAlign: "center" }}>
        <h2 className="mkt-h2">More on how any of this works</h2>
        <p className="mkt-lede" style={{ margin: "0 auto 24px" }}>
          Cancellations, refunds, and the full safety flow — all explained plainly, no fine print.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/faq" className="mkt-btn mkt-btn-primary">Read the FAQ</Link>
          <Link href="/safety" className="mkt-btn mkt-btn-secondary">Read about safety</Link>
        </div>
      </section>
    </MarketingShell>
  );
}
