import type { Metadata } from "next";
import Link from "next/link";
import { Smartphone, KeyRound, ShieldCheck, Globe } from "lucide-react";
import { MarketingShell } from "../../components/MarketingShell";
import { SITE_URL, BRAND_NAME, BRAND_TAGLINE, STORE_LINKS_READY } from "../../lib/siteContent";

const TITLE = "Download the app";
const DESCRIPTION = `Get ${BRAND_NAME} — carpooling with pickup verification, live SOS, and verified drivers on every ride. Available for Android, with iOS on the way.`;

export const metadata: Metadata = {
  title: `${TITLE} — ${BRAND_NAME}`,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/download` },
  openGraph: { title: `${TITLE} — ${BRAND_NAME}`, description: DESCRIPTION, url: `${SITE_URL}/download`, siteName: BRAND_NAME, type: "website" },
};

const HIGHLIGHTS = [
  { icon: KeyRound, text: "Pickup verification on every ride" },
  { icon: ShieldCheck, text: "Live SOS with emergency contacts" },
  { icon: Globe, text: "English, Hindi, Tamil, Kannada, Marathi, Bengali" },
];

export default function DownloadPage() {
  // SoftwareApplication schema — deliberately no aggregateRating/review
  // fields. Fabricating a star rating or review count here to look more
  // "complete" for rich results would be exactly the kind of fake
  // social proof this project has avoided everywhere else (see the
  // landing page's own no-testimonials decision) — add this once real
  // store ratings exist, not before.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: BRAND_NAME,
    applicationCategory: "TravelApplication",
    operatingSystem: "Android",
    description: DESCRIPTION,
    url: `${SITE_URL}/download`,
  };

  return (
    <MarketingShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <section className="mkt-section-tight" style={{ textAlign: "center" }}>
        <Smartphone size={28} color="#185FA5" style={{ marginBottom: 12 }} />
        <h1 className="mkt-h1" style={{ fontSize: "clamp(28px, 4vw, 40px)" }}>{TITLE}</h1>
        <p className="mkt-lede" style={{ margin: "0 auto 28px" }}>{BRAND_TAGLINE} — {DESCRIPTION.toLowerCase()}</p>

        {STORE_LINKS_READY ? (
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="#" className="mkt-btn mkt-btn-primary">Get it on Google Play</a>
            <a href="#" className="mkt-btn mkt-btn-secondary">Download on the App Store</a>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <span className="mkt-btn mkt-btn-disabled">
              Get it on Google Play
              <span className="mkt-btn-badge">Coming soon</span>
            </span>
            <span className="mkt-btn mkt-btn-disabled">
              Download on the App Store
              <span className="mkt-btn-badge">Coming soon</span>
            </span>
            <p style={{ fontSize: 13, color: "#888780", marginTop: 8 }}>
              Not on the app stores yet — check the <Link href="/faq" style={{ color: "#185FA5" }}>FAQ</Link> or{" "}
              <Link href="/blog" style={{ color: "#185FA5" }}>blog</Link> in the meantime.
            </p>
          </div>
        )}
      </section>

      <section className="mkt-section">
        <div className="mkt-grid-3">
          {HIGHLIGHTS.map((h) => (
            <div key={h.text} className="mkt-card" style={{ textAlign: "center" }}>
              <div className="mkt-card-icon" style={{ background: "#E6F1FB", margin: "0 auto 14px" }}>
                <h.icon size={20} color="#0C447C" />
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#1A1A18", margin: 0 }}>{h.text}</p>
            </div>
          ))}
        </div>
      </section>
    </MarketingShell>
  );
}
