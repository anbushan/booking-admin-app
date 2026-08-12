import type { Metadata } from "next";
import { Mail, ShieldAlert } from "lucide-react";
import { MarketingShell } from "../../components/MarketingShell";
import { SITE_URL, BRAND_NAME, CONTACT_EMAIL } from "../../lib/siteContent";

const TITLE = "Contact us";
const DESCRIPTION = `Get in touch with the ${BRAND_NAME} team — support, feedback, or a safety concern.`;

export const metadata: Metadata = {
  title: `${TITLE} — ${BRAND_NAME}`,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/contact` },
  openGraph: { title: `${TITLE} — ${BRAND_NAME}`, description: DESCRIPTION, url: `${SITE_URL}/contact`, siteName: BRAND_NAME, type: "website" },
};

export default function ContactPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    name: `${TITLE} — ${BRAND_NAME}`,
    url: `${SITE_URL}/contact`,
    about: {
      "@type": "Organization",
      name: BRAND_NAME,
      contactPoint: { "@type": "ContactPoint", email: CONTACT_EMAIL, contactType: "customer support" },
    },
  };

  return (
    <MarketingShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <section className="mkt-section-tight">
        <span className="mkt-eyebrow">Get in touch</span>
        <h1 className="mkt-h1" style={{ fontSize: "clamp(28px, 4vw, 40px)" }}>{TITLE}</h1>
        <p className="mkt-lede" style={{ maxWidth: "none" }}>
          Questions about a booking, feedback on the app, or something that needs a closer look — reach out
          directly and we'll follow up.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 32 }}>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="mkt-card"
            style={{ display: "flex", alignItems: "center", gap: 16, textDecoration: "none" }}
          >
            <div className="mkt-card-icon" style={{ background: "#E6F1FB", marginBottom: 0, flexShrink: 0 }}>
              <Mail size={20} color="#0C447C" />
            </div>
            <div>
              <h3 style={{ margin: 0 }}>General support & feedback</h3>
              <p style={{ margin: "4px 0 0" }}>{CONTACT_EMAIL}</p>
            </div>
          </a>

          <div className="mkt-card" style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div className="mkt-card-icon" style={{ background: "#FCEBEB", marginBottom: 0, flexShrink: 0 }}>
              <ShieldAlert size={20} color="#A32D2D" />
            </div>
            <div>
              <h3 style={{ margin: 0 }}>Safety concern during a ride</h3>
              <p style={{ margin: "4px 0 0" }}>
                Use the in-app SOS button first — it reaches your emergency contacts immediately, faster than
                email can. Follow up here afterward if you need to.
              </p>
            </div>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
