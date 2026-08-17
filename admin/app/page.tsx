import type { Metadata } from "next";
import Link from "next/link";
import {
  MapPin,
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  MessageCircle,
  Wallet,
  Star,
  Car,
  Search,
  CheckCircle2,
  Navigation,
  Route,
  Globe,
  Users,
  Bell,
  RotateCcw,
  Repeat,
  Share2,
} from "lucide-react";
import { MarketingShell } from "../components/MarketingShell";
import { JourneyMockup, type MockupKind } from "../components/JourneyMockup";
import { HeroTilt } from "../components/marketing/HeroTilt";
import { ScrollReveal3D } from "../components/marketing/ScrollReveal3D";
import { SITE_URL, BRAND_NAME, BRAND_TAGLINE, STORE_LINKS_READY } from "../lib/siteContent";

// Was: `export default function RootPage() { redirect(getSession() ?
// "/dashboard" : "/login"); }` — every visitor to the bare domain,
// admin or not, got bounced straight into an auth flow with nothing
// public at "/" at all. This is that real landing page instead;
// /login is still reachable (linked from the footer), it's just no
// longer the default.
export const metadata: Metadata = {
  title: `${BRAND_NAME} — ${BRAND_TAGLINE}`,
  description:
    "NanbaGO is a carpooling platform, not a taxi app. Share real trips with verified drivers, pay a small upfront platform fee, and settle the rest directly — with pickup verification, live SOS, and driver vetting built into every ride.",
  alternates: { canonical: SITE_URL },
  openGraph: {
    title: `${BRAND_NAME} — ${BRAND_TAGLINE}`,
    description: "Carpooling built around real trust. Pickup verification, live SOS, and verified drivers on every ride.",
    url: SITE_URL,
    siteName: BRAND_NAME,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND_NAME} — ${BRAND_TAGLINE}`,
    description: "Carpooling built around real trust. Pickup verification, live SOS, and verified drivers on every ride.",
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: BRAND_NAME,
  url: SITE_URL,
  slogan: BRAND_TAGLINE,
  description: "A carpooling platform matching drivers with spare seats to passengers going the same way.",
};

// Deliberately distinct from SAFETY_FEATURES below — this is the full
// product feature set (matching, languages, notifications, policy),
// safety-specific features get their own dedicated section since
// that's what people actually search FAQs for first.
const FEATURES = [
  { icon: Route, title: "Route & detour-aware matching", body: "Rides going your way show up within the driver's own detour tolerance — not just an exact start/end match." },
  { icon: Globe, title: "6 languages", body: "English, Hindi, Tamil, Kannada, Marathi, and Bengali — switch any time from Settings." },
  { icon: Users, title: "One account, two roles", body: "Ride as a passenger, offer rides as a driver, or both — switch anytime from the same phone number." },
  { icon: Navigation, title: "Live trip tracking", body: "Follow the trip in real time from pickup to drop, not just a status label that updates late." },
  { icon: Bell, title: "Notified every step", body: "Booking accepted, payment due, driver arrived, trip complete — a notification for each, not radio silence in between." },
  { icon: RotateCcw, title: "Flexible cancellations", body: "A shared grace window after payment, and automatic refunds if a driver cancels or never shows up." },
  { icon: Wallet, title: "Fair, capped pricing", body: "A per-kilometre cap on top of a small upfront platform fee — cost-sharing, never a surge fare." },
  { icon: ShieldAlert, title: "Built-in accountability", body: "Repeated late cancellations or no-shows escalate through real warnings before any account action." },
  { icon: Repeat, title: "Repeat rides, set up once", body: "Drive the same route daily? Set the days and time once and it keeps publishing itself — pause or stop it whenever you want." },
];

const SAFETY_FEATURES = [
  { icon: KeyRound, title: "Pickup verification", body: "A one-time code the passenger reads aloud — the trip can't start without it." },
  { icon: ShieldCheck, title: "Live SOS", body: "One tap shares your real-time location with emergency contacts you've already set up." },
  { icon: Car, title: "Verified drivers & vehicles", body: "A separate licence badge and RC badge per vehicle — earned instantly with a small paid check, or free via manual review. Either way, publishing itself never requires it." },
  { icon: ShieldCheck, title: "Passengers can verify too", body: "An optional Aadhaar check passengers can complete themselves — a green badge drivers see when deciding whether to accept a request." },
  { icon: Star, title: "Ratings that stick", body: "Every completed ride can be rated — visible on a profile before you ever share a car." },
  { icon: MessageCircle, title: "In-app chat", body: "Coordinate pickup details directly, without sharing a real phone number." },
  { icon: Share2, title: "Share your trip", body: "Send anyone — even someone outside the app — a live link to your route and location for the ride, one tap from the trip screen." },
  { icon: Wallet, title: "Fair, capped fares", body: "A per-km cap keeps this cost-sharing, not a taxi fare in disguise." },
];

const STEPS = [
  { icon: Search, title: "Search your route", body: "Enter pickup and drop — see published rides going your way, within the driver's detour tolerance." },
  { icon: CheckCircle2, title: "Request & get accepted", body: "Send a request; the driver accepts or declines. Once accepted, pay the small upfront platform fee to lock your seat." },
  { icon: Navigation, title: "Verify & ride", body: "Read your pickup code aloud when the driver arrives, then track the trip live until you're dropped off." },
];

// The two full journeys, login through payment — five steps each, shown
// with illustrative mockups (see JourneyMockup.tsx for why these aren't
// real screenshots). Passenger pays to lock a seat right after being
// accepted; a driver's "payment" step is the mirror of that — collecting
// the remaining fare once the trip's actually done.
const PASSENGER_JOURNEY: { title: string; body: string; mockup: MockupKind }[] = [
  { title: "Log in", body: "Verify your phone number with an OTP — no password to remember, no email required.", mockup: "otp" },
  { title: "Search & request a ride", body: "Enter your pickup and drop points and request a seat on a ride actually going your way.", mockup: "search" },
  { title: "Get accepted & pay", body: "Once the driver accepts, pay the small upfront platform fee to lock your seat in.", mockup: "payFee" },
  { title: "Verify & ride", body: "Read your pickup code aloud when the driver arrives, then track the trip live until you arrive.", mockup: "tracking" },
  { title: "Rate your driver", body: "Trip complete — rate and review before you're done, visible on their profile for the next rider.", mockup: "rating" },
];

const DRIVER_JOURNEY: { title: string; body: string; mockup: MockupKind }[] = [
  { title: "Log in", body: "Verify your phone number with an OTP, then switch into driver mode from the side menu.", mockup: "otp" },
  { title: "Add your vehicle", body: "Just make, model, and registration number — you can publish immediately. Get verified anytime after: an instant paid check, or free manual review.", mockup: "vehicle" },
  { title: "Publish a ride & accept requests", body: "Set your route, seats, and detour tolerance, then accept the requests that work for you.", mockup: "requests" },
  { title: "Start the trip", body: "Enter the pickup code your passenger reads aloud — the trip can't start without it.", mockup: "otpVerify" },
  { title: "Complete & collect payment", body: "Mark the trip done, then confirm the remaining fare was collected in cash or UPI.", mockup: "collectPayment" },
];

function JourneySection({ id, eyebrow, heading, lede, steps }: {
  id: string;
  eyebrow: string;
  heading: string;
  lede: string;
  steps: { title: string; body: string; mockup: MockupKind }[];
}) {
  return (
    <div id={id}>
      <span className="mkt-eyebrow">{eyebrow}</span>
      <h2 className="mkt-h2" style={{ marginTop: 12 }}>{heading}</h2>
      <p className="mkt-lede">{lede}</p>
      <div className="mkt-journey-list">
        {steps.map((step, i) => (
          <div key={step.title} className="mkt-journey-step">
            <div className="mkt-journey-step-body">
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <div className="mkt-step-number">{i + 1}</div>
              </div>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </div>
            {/* Staggered per-step delay (each mockup a beat behind the
                one before it) rather than every mockup in a section
                popping in at once the moment they cross the same
                scroll threshold. */}
            <ScrollReveal3D delayMs={i * 80}>
              <JourneyMockup kind={step.mockup} />
            </ScrollReveal3D>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <MarketingShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />

      <section className="mkt-section">
        <div className="mkt-hero">
          <div>
            <span className="mkt-eyebrow">Not a taxi app — real carpooling</span>
            <h1 className="mkt-h1">{BRAND_TAGLINE}</h1>
            <p className="mkt-lede">
              NanbaGO matches drivers already making a trip with passengers going the same way. Pay a
              small platform fee upfront, settle the rest of the fare directly — with pickup verification,
              live SOS, and vetted drivers built into every single ride. Currently available in Chennai
              and Bengaluru.
            </p>
            <div className="mkt-hero-ctas">
              {STORE_LINKS_READY ? (
                <>
                  <a href="#" className="mkt-btn mkt-btn-primary">Get it on Google Play</a>
                  <a href="#" className="mkt-btn mkt-btn-secondary">Download on the App Store</a>
                </>
              ) : (
                <>
                  <Link href="/download" className="mkt-btn mkt-btn-disabled">
                    Get it on Google Play
                    <span className="mkt-btn-badge">Coming soon</span>
                  </Link>
                  <Link href="/faq" className="mkt-btn mkt-btn-secondary">Read the FAQ</Link>
                </>
              )}
            </div>
          </div>

          <div className="mkt-hero-visual" aria-hidden="true">
            {/* Idle float + mouse-parallax tilt (HeroTilt/globals.css's
                .mkt-tilt/.mkt-float) — the card previously just sat flat
                on the gradient backdrop with no motion at all. */}
            <HeroTilt>
              <div className="mkt-hero-visual-card">
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "#E6F1FB", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <KeyRound size={18} color="#0C447C" />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#1A1A18" }}>Pickup code</div>
                    <div style={{ fontSize: 11, color: "#888780" }}>Share with your driver</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  {["4", "8", "1", "2"].map((d, i) => (
                    <div key={i} style={{ width: 40, height: 46, borderRadius: 10, background: "#E6F1FB", border: "1px solid #185FA5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, color: "#0C447C" }}>
                      {d}
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "#EAF3DE", borderRadius: 10 }}>
                  <ShieldCheck size={16} color="#3B6D11" />
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#3B6D11" }}>Trip verified — ride started</span>
                </div>
              </div>
            </HeroTilt>
          </div>
        </div>
      </section>

      <section className="mkt-section" id="how-it-works">
        <span className="mkt-eyebrow">How it works</span>
        <h2 className="mkt-h2" style={{ marginTop: 12 }}>From search to seat, three steps</h2>
        <p className="mkt-lede">No dispatch, no surge pricing — just real people sharing real trips.</p>
        <div className="mkt-grid-3">
          {STEPS.map((step, i) => (
            <div key={step.title} className="mkt-card">
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div className="mkt-step-number">{i + 1}</div>
                <step.icon size={20} color="#185FA5" />
              </div>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mkt-section" id="features">
        <span className="mkt-eyebrow">Everything in the app</span>
        <h2 className="mkt-h2" style={{ marginTop: 12 }}>The full feature set, not just the highlights</h2>
        <p className="mkt-lede">Beyond matching and safety — what's actually running end to end.</p>
        <div className="mkt-grid-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="mkt-card">
              <div className="mkt-card-icon" style={{ background: "#E6F1FB" }}>
                <f.icon size={20} color="#0C447C" />
              </div>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mkt-section" style={{ background: "#FBFAF7" }}>
        <JourneySection
          id="passenger-journey"
          eyebrow="Passenger journey"
          heading="Login to payment — the whole ride, step by step"
          lede="Every screen a passenger actually sees, from verifying your number to rating your driver."
          steps={PASSENGER_JOURNEY}
        />
      </section>

      <section className="mkt-section">
        <JourneySection
          id="driver-journey"
          eyebrow="Driver journey"
          heading="Login to payment — offering rides, step by step"
          lede="From adding your vehicle to collecting the fare — what actually happens on the driver side."
          steps={DRIVER_JOURNEY}
        />
      </section>

      <section className="mkt-section" id="safety">
        <span className="mkt-eyebrow">Safety, by design</span>
        <h2 className="mkt-h2" style={{ marginTop: 12 }}>Trust that doesn't rely on luck</h2>
        <p className="mkt-lede">Every one of these runs on every ride — not an opt-in setting buried in a menu.</p>
        <div className="mkt-grid-3">
          {SAFETY_FEATURES.map((f) => (
            <div key={f.title} className="mkt-card">
              <div className="mkt-card-icon" style={{ background: "#E6F1FB" }}>
                <f.icon size={20} color="#0C447C" />
              </div>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </div>
          ))}
        </div>
        <Link href="/safety" className="mkt-btn mkt-btn-secondary" style={{ marginTop: 24 }}>
          More on how safety works
        </Link>
      </section>

      <section className="mkt-band">
        <div className="mkt-section mkt-band-grid">
          <div>
            <span className="mkt-eyebrow" style={{ background: "rgba(217,127,10,0.18)", color: "#FBECD4" }}>For drivers</span>
            <h2 className="mkt-h2" style={{ marginTop: 12 }}>Already making the trip? Take someone with you.</h2>
            <p className="mkt-lede" style={{ color: "#C7C4B8" }}>
              Add your vehicle and start publishing immediately — no review required. Get verified
              whenever you want the trust badge: an instant paid check, or free manual review.
              Set your own detour tolerance and seats; riders come to you.
            </p>
          </div>
          <div>
            <Link href="/pricing" className="mkt-btn mkt-btn-primary" style={{ background: "#D97F0A", boxShadow: "0 8px 20px rgba(217,127,10,0.3)" }}>
              See verification pricing
            </Link>
          </div>
        </div>
      </section>

      <section className="mkt-section-tight" style={{ textAlign: "center" }}>
        <MapPin size={28} color="#185FA5" style={{ marginBottom: 12 }} />
        <h2 className="mkt-h2">Have questions before you ride?</h2>
        <p className="mkt-lede" style={{ margin: "0 auto 24px" }}>
          The platform fee, cancellations, refunds, and the safety flow — explained plainly, no fine print.
        </p>
        <Link href="/faq" className="mkt-btn mkt-btn-primary">Read the full FAQ</Link>
      </section>
    </MarketingShell>
  );
}
