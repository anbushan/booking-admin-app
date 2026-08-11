import type { Metadata } from "next";
import { HelpCircle } from "lucide-react";
import { MarketingShell } from "../../components/MarketingShell";
import { SITE_URL, BRAND_NAME, FAQ_GROUPS } from "../../lib/siteContent";

const TITLE = "Frequently asked questions";
const DESCRIPTION = `How ${BRAND_NAME} works — the platform fee, booking, cancellations, refunds, safety, and driver verification, explained plainly.`;

export const metadata: Metadata = {
  title: `${TITLE} — ${BRAND_NAME}`,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/faq` },
  openGraph: { title: `${TITLE} — ${BRAND_NAME}`, description: DESCRIPTION, url: `${SITE_URL}/faq`, siteName: BRAND_NAME, type: "website" },
};

export default function FaqPage() {
  // FAQPage structured data — one entity per question across every
  // group, matching schema.org's flat mainEntity list (Google's rich
  // results don't care about our own section headings, just the actual
  // Q/A pairs) so this is eligible for the FAQ rich-result treatment.
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_GROUPS.flatMap((group) =>
      group.items.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      }))
    ),
  };

  return (
    <MarketingShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      <section className="mkt-section-tight">
        <HelpCircle size={28} color="#185FA5" style={{ marginBottom: 12 }} />
        <h1 className="mkt-h1" style={{ fontSize: "clamp(28px, 4vw, 40px)" }}>{TITLE}</h1>
        <p className="mkt-lede" style={{ maxWidth: "none" }}>{DESCRIPTION}</p>

        {FAQ_GROUPS.map((group) => (
          <div key={group.heading} className="mkt-faq-group">
            <div className="mkt-faq-group-heading">{group.heading}</div>
            {group.items.map((item) => (
              <details key={item.question} className="mkt-faq-item">
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        ))}
      </section>
    </MarketingShell>
  );
}
