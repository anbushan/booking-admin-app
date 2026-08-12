import type { Metadata } from "next";
import Link from "next/link";
import { Heart, ShieldCheck, Wallet, Users } from "lucide-react";
import { MarketingShell } from "../../components/MarketingShell";
import { SITE_URL, BRAND_NAME, BRAND_TAGLINE } from "../../lib/siteContent";

const TITLE = "About us";
const DESCRIPTION = `${BRAND_NAME} is a carpooling platform built around trust, not a taxi service — matching drivers already making a trip with passengers going the same way, cost-shared and safety-first.`;

export const metadata: Metadata = {
  title: `${TITLE} — ${BRAND_NAME}`,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/about` },
  openGraph: { title: `${TITLE} — ${BRAND_NAME}`, description: DESCRIPTION, url: `${SITE_URL}/about`, siteName: BRAND_NAME, type: "website" },
};

const VALUES = [
  { icon: Heart, title: "Cost-sharing, not a taxi service", body: "A driver on NanbaGO is someone already making the trip — not a commercial driver on the clock. The fare is capped per kilometre specifically to keep it that way." },
  { icon: ShieldCheck, title: "Trust has to be built in, not assumed", body: "Pickup verification, live SOS, and per-vehicle driver checks aren't premium features — they run on every single ride, by default." },
  { icon: Wallet, title: "Honest about what the app charges for", body: "A small platform fee, paid once, upfront — that's what funds matching and safety. Everything else is settled directly between the two people sharing the ride." },
  { icon: Users, title: "Built for people, not just trips", body: "One account can ride today and drive tomorrow. Ratings, chat, and history all follow the person, not a disposable session." },
];

export default function AboutPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: `About ${BRAND_NAME}`,
    url: `${SITE_URL}/about`,
    description: DESCRIPTION,
    about: { "@type": "Organization", name: BRAND_NAME, slogan: BRAND_TAGLINE },
  };

  return (
    <MarketingShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <section className="mkt-section-tight">
        <span className="mkt-eyebrow">About {BRAND_NAME}</span>
        <h1 className="mkt-h1" style={{ fontSize: "clamp(28px, 4vw, 40px)" }}>{BRAND_TAGLINE}</h1>
        <p className="mkt-lede" style={{ maxWidth: "none" }}>
          Most ride apps in India are taxi apps wearing a different name — the driver is still working, the fare
          is still a commercial rate, and the "sharing" is just marketing copy. {BRAND_NAME} is trying to build
          the thing carpooling actually promises: two people who were already going the same way, splitting a
          real cost, with the trust and safety pieces that make that comfortable for both sides.
        </p>
        <p className="mkt-lede" style={{ maxWidth: "none", marginTop: 16 }}>
          "Dosti" means friendship — the idea being that a shared ride works best when it feels closer to
          getting a lift from someone you know than to hailing a stranger. That shapes what we actually built:
          who you're riding with is visible before you ever meet, a pickup can't be faked, and if something's
          wrong there's a real safety flow, not just a support ticket after the fact.
        </p>
      </section>

      <section className="mkt-section">
        <h2 className="mkt-h2">What that looks like in practice</h2>
        <div className="mkt-grid-4">
          {VALUES.map((v) => (
            <div key={v.title} className="mkt-card">
              <div className="mkt-card-icon" style={{ background: "#E6F1FB" }}>
                <v.icon size={20} color="#0C447C" />
              </div>
              <h3>{v.title}</h3>
              <p>{v.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mkt-section-tight" style={{ textAlign: "center" }}>
        <h2 className="mkt-h2">See exactly how it works</h2>
        <p className="mkt-lede" style={{ margin: "0 auto 24px" }}>
          The platform fee, the safety flow, cancellations — nothing here is hidden in fine print.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/safety" className="mkt-btn mkt-btn-primary">Read about safety</Link>
          <Link href="/faq" className="mkt-btn mkt-btn-secondary">Read the FAQ</Link>
        </div>
      </section>
    </MarketingShell>
  );
}
