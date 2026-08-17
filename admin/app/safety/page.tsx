import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound, ShieldCheck, Car, Star, MessageCircle, Wallet, AlertTriangle, PhoneCall, Share2 } from "lucide-react";
import { MarketingShell } from "../../components/MarketingShell";
import { FloatingIconCluster } from "../../components/marketing/FloatingIconCluster";
import { SITE_URL, BRAND_NAME } from "../../lib/siteContent";

const TITLE = "Safety";
const DESCRIPTION = `Every safety feature actually running on every ${BRAND_NAME} ride — pickup verification, live SOS, per-vehicle driver checks, and what happens if something goes wrong.`;

export const metadata: Metadata = {
  title: `${TITLE} — ${BRAND_NAME}`,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/safety` },
  openGraph: { title: `${TITLE} — ${BRAND_NAME}`, description: DESCRIPTION, url: `${SITE_URL}/safety`, siteName: BRAND_NAME, type: "website" },
};

const DEEP_FEATURES = [
  {
    icon: KeyRound,
    title: "Pickup verification",
    body: "When your driver arrives, the app generates a one-time code that only ever appears on the passenger's own screen — not sent by SMS, not guessable, not reusable. You read it aloud, the driver enters it, and the trip literally cannot move to \"in progress\" until that happens. Neither side can skip this step or start the trip without it.",
  },
  {
    icon: ShieldCheck,
    title: "Live SOS",
    body: "Every trip has an SOS button. Pressing it shares your real-time GPS location with your emergency contacts immediately — not a delayed check-in, not a message queued for later. Those contacts are set up in advance from your profile, so there's nothing to configure in the moment something actually goes wrong.",
  },
  {
    icon: Car,
    title: "Two separate verification badges, not one",
    body: "A licence badge (once per driver, covers every vehicle) and an RC badge (once per vehicle — the registration is tied to that specific car, not the driver). Either is earned instantly with a small paid automated check, or free via manual admin review — look for both badges before you ride, not just one.",
  },
  {
    icon: ShieldCheck,
    title: "Passengers can verify their ID too",
    body: "Verification isn't one-sided — a passenger can optionally complete the same kind of check on their own Aadhaar, earning a green badge a driver sees right on the request before deciding to accept. Entirely optional; booking works exactly the same without it.",
  },
  {
    icon: Star,
    title: "Ratings that follow the account",
    body: "Every completed trip can be rated by both sides. That history is visible on a profile before you ever agree to share a car with someone — not hidden, not reset, not something only the app itself can see.",
  },
  {
    icon: MessageCircle,
    title: "In-app chat, no real number shared",
    body: "Coordinating pickup details happens through the app's own chat, open only for the pre-trip window — from the moment a booking's confirmed to the moment the trip actually starts. It closes automatically once you're on the road, since coordination is over by then.",
  },
  {
    icon: Share2,
    title: "Share your trip with anyone",
    body: "One tap from the live tracking screen sends your route and real-time location to whoever you choose — a family member, a friend — even if they've never opened the app. Useful on its own, not just as a backup for SOS.",
  },
  {
    icon: Wallet,
    title: "A fare that can't quietly become a taxi rate",
    body: "The per-kilometre fare is capped platform-wide. That's not a pricing gimmick — it's what keeps this a genuine cost-sharing arrangement instead of a disguised commercial fare.",
  },
  {
    icon: AlertTriangle,
    title: "Real accountability for no-shows and late cancels",
    body: "A driver who repeatedly cancels late or doesn't show up escalates through a warning, a final warning, and then a temporary account block that lifts automatically. It's not a one-strike system, but it's not toothless either — and if a driver genuinely doesn't show up, your booking auto-cancels and refunds without you needing to do anything.",
  },
];

export default function SafetyPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `${TITLE} — ${BRAND_NAME}`,
    url: `${SITE_URL}/safety`,
    description: DESCRIPTION,
  };

  return (
    <MarketingShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <section className="mkt-section-tight">
        <div className="mkt-hero-with-icons">
          <div>
            <span className="mkt-eyebrow">Safety, in detail</span>
            <h1 className="mkt-h1" style={{ fontSize: "clamp(28px, 4vw, 40px)" }}>Trust that doesn't rely on luck</h1>
            <p className="mkt-lede" style={{ maxWidth: "none" }}>
              None of this is a settings toggle you have to remember to turn on. It's built into the shape of the
              booking flow itself, so it's there whether or not anyone's thinking about it in the moment.
            </p>
          </div>
          <FloatingIconCluster icons={[ShieldCheck, KeyRound, AlertTriangle]} />
        </div>
      </section>

      <section className="mkt-section">
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          {DEEP_FEATURES.map((f) => (
            <div key={f.title} style={{ display: "flex", gap: 20, alignItems: "flex-start", borderBottom: "1px solid #E3E1D8", paddingBottom: 32 }}>
              <div className="mkt-card-icon" style={{ background: "#E6F1FB", flexShrink: 0 }}>
                <f.icon size={20} color="#0C447C" />
              </div>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: "#1A1A18", margin: "0 0 8px" }}>{f.title}</h3>
                <p style={{ fontSize: 15, lineHeight: 1.7, color: "#5F5E5A", margin: 0, maxWidth: 640 }}>{f.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mkt-section-tight" style={{ textAlign: "center" }}>
        <PhoneCall size={28} color="#185FA5" style={{ marginBottom: 12 }} />
        <h2 className="mkt-h2">Something feel off during a ride?</h2>
        <p className="mkt-lede" style={{ margin: "0 auto 24px" }}>
          Use the in-app SOS button first — it reaches your emergency contacts immediately. For anything
          else, reach out and we'll follow up directly.
        </p>
        <Link href="/contact" className="mkt-btn mkt-btn-primary">Contact us</Link>
      </section>
    </MarketingShell>
  );
}
