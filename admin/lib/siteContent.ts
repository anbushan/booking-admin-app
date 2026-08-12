// Single source of truth for the public marketing site's copy, nav, FAQ,
// and blog content — every page (landing, FAQ, blog, sitemap) reads from
// here instead of repeating strings, so a fact (the platform fee %, the
// refund window) only has to be right in one place.
//
// SITE_URL is a real placeholder, not a guess dressed up as one: no
// custom domain is attached to this Vercel project yet (checked via
// `vercel domains ls` / `vercel project ls` — only the default
// carpool-admin-gray.vercel.app exists). Update this the moment a real
// domain is attached; canonical URLs, Open Graph tags, and the sitemap
// all key off it.
export const SITE_URL = "https://carpool-admin-gray.vercel.app";

// Shared by robots.ts and the root layout's default metadata (belt and
// suspenders: robots.txt disallow keeps crawlers from ever fetching a
// non-production page, and a meta noindex tag keeps it out of the
// index even if a URL got linked/crawled some other way — robots.txt
// alone doesn't guarantee that). Vercel sets VERCEL_ENV to "production"
// /"preview"/"development" on every deploy; falls back to NODE_ENV for
// local dev or any non-Vercel host.
export const IS_PRODUCTION = process.env.VERCEL_ENV
  ? process.env.VERCEL_ENV === "production"
  : process.env.NODE_ENV === "production";
export const BRAND_NAME = "NanbaGO";
export const BRAND_TAGLINE = "Dosti For Every Journey";
export const CONTACT_EMAIL = "anbushanthi001@gmail.com";

// Real store links aren't wired up here on purpose — no Play Store/App
// Store listing URL exists anywhere in this codebase or this
// conversation, and a plausible-looking fake one would be actively
// misleading on a real public page. NAV/hero CTAs point at "#" with a
// visible "Coming soon" state instead; swap in the real listing URL(s)
// once the app is actually published.
export const STORE_LINKS_READY = false;

// Trimmed from 7 to 6 — and, more importantly, switched from same-page
// scroll anchors (#features, #passenger-journey, ...) to real distinct
// URLs. Two reasons: the anchor-heavy version is what caused the mobile
// header bug (7 items in a horizontal scroll strip, hard-cropped on a
// phone — see globals.css's mask-image fix); and fragment anchors carry
// no SEO weight of their own (they're not separately indexable pages),
// while these are — every one of these is a real crawlable URL now, so
// the nav itself is also internal-linking work, not just navigation.
export const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/safety", label: "Safety" },
  { href: "/download", label: "Download" },
  { href: "/faq", label: "FAQ" },
  { href: "/blog", label: "Blog" },
];

export const FOOTER_LINKS = [
  { href: "/about", label: "About" },
  { href: "/safety", label: "Safety" },
  { href: "/download", label: "Download" },
  { href: "/faq", label: "FAQ" },
  { href: "/blog", label: "Blog" },
  { href: "/contact", label: "Contact" },
  { href: "/legal/terms", label: "Terms" },
  { href: "/legal/privacy", label: "Privacy" },
];

export type FaqItem = { question: string; answer: string };
export type FaqGroup = { heading: string; items: FaqItem[] };

// Every answer here matches actual app behavior (booking states, config
// defaults, safety flow) rather than generic copy — checked against the
// backend's own logic, not written blind. Where a number is an
// admin-configurable default (platform fee %, refund window), it's
// phrased as "currently" so this doesn't go stale the moment an admin
// changes AppConfig.
export const FAQ_GROUPS: FaqGroup[] = [
  {
    heading: "Getting started",
    items: [
      {
        question: "Is NanbaGO a taxi service?",
        answer:
          "No — NanbaGO is a carpooling platform, not a taxi or ride-hailing service. Drivers are everyday people already making a trip who have spare seats, not commercial drivers on the clock. The platform fee covers matching and safety features; the rest of the fare is a cost-sharing contribution settled directly between passenger and driver, capped per kilometre so it never becomes a profit-making fare.",
      },
      {
        question: "How do I sign up?",
        answer:
          "Enter your phone number and verify it with an OTP — no email or password needed to get started. From there you choose whether you're riding as a passenger or offering rides as a driver; you can add the other role to the same phone number later at any time.",
      },
      {
        question: "Can one account be both a driver and a passenger?",
        answer:
          "Yes. Switch between driver and passenger mode from the side menu whenever you like — your bookings, ratings, and history stay attached to the same account either way.",
      },
      {
        question: "What languages does the app support?",
        answer: "English, Hindi, Tamil, Kannada, Marathi, and Bengali. Change it any time from Settings.",
      },
    ],
  },
  {
    heading: "Booking a ride",
    items: [
      {
        question: "How does matching work?",
        answer:
          "Search your pickup and drop points and NanbaGO shows published rides going your way, within the driver's set detour tolerance. Request a seat, and the driver accepts or declines — it's a real, mutual match, not an automatic assignment.",
      },
      {
        question: "What's the platform fee, and when do I pay it?",
        answer:
          "Once a driver accepts your request, you pay a small upfront platform fee (currently 10% of the fare) to lock in your seat — that's the only in-app charge. The rest of the fare is settled directly with the driver in cash or UPI once the trip is done, and never touches the app.",
      },
      {
        question: "How long do I have to pay after a driver accepts?",
        answer:
          "Currently 30 minutes. If the window lapses without payment, the request expires automatically and the seat opens back up — no penalty, nothing was charged.",
      },
      {
        question: "Can I cancel a booking?",
        answer:
          "Yes, freely, right up until the platform fee is actually paid — no penalty either way. After payment, there's a shared grace window (currently 30 minutes) where either side can still cancel penalty-free. Past that window, a driver cancelling still refunds your fee in full; a passenger cancelling after paying doesn't get the fee back, since the driver already turned down other requests to hold that seat.",
      },
    ],
  },
  {
    heading: "Safety",
    items: [
      {
        question: "How does NanbaGO verify it's really me getting into the right car?",
        answer:
          "When the driver arrives, they generate a one-time pickup code that only shows up on your phone — you read it aloud, the driver enters it, and only then does the trip actually start. Neither side can skip this step.",
      },
      {
        question: "What if something goes wrong during a trip?",
        answer:
          "Every trip has an SOS button that shares your live location with your emergency contacts immediately. Your emergency contacts are set up in advance from your profile, so there's nothing to configure in the moment.",
      },
      {
        question: "Are drivers verified?",
        answer:
          "Every driver's vehicle documents (registration certificate, and optionally a driving licence and vehicle photo) go through review before that vehicle can be used to publish a single ride — not a one-time account check, a per-vehicle one.",
      },
      {
        question: "Can I see who I'm riding with before the trip?",
        answer:
          "Yes — the other person's name, photo, and rating are shown on your booking before you ever meet, and in-app chat opens as soon as the booking's confirmed so you can coordinate pickup details directly.",
      },
    ],
  },
  {
    heading: "Payments & refunds",
    items: [
      {
        question: "What happens to my payment if a driver cancels?",
        answer: "Refunded in full automatically, regardless of timing — a driver cancelling is never something you're penalized for.",
      },
      {
        question: "How long does a refund take?",
        answer: "Currently within 3 working days of being initiated. You'll see its status update in the app as it moves through processing.",
      },
      {
        question: "What if my driver never shows up?",
        answer:
          "If a trip never starts within the no-show grace period after the scheduled departure time, your booking is automatically cancelled and refunded — you don't need to do anything or contact support first.",
      },
    ],
  },
  {
    heading: "Driving with NanbaGO",
    items: [
      {
        question: "What do I need to start offering rides?",
        answer:
          "A vehicle with a valid registration certificate you can photograph and upload. Add your car's details and documents from the app, and you can publish your first ride as soon as it's reviewed and approved.",
      },
      {
        question: "How long does vehicle approval take?",
        answer: "Typically within an hour. You'll get a notification either way, and if it's rejected you'll see exactly why and can fix and resubmit.",
      },
      {
        question: "What happens if I repeatedly cancel or don't show up?",
        answer:
          "Repeated late cancellations or no-shows escalate through a warning, a final warning, and then a temporary account block that lifts automatically — the same rules apply to every driver, and honoring an accepted booking is what avoids all of it.",
      },
    ],
  },
];

export type BlogPost = {
  slug: string;
  title: string;
  excerpt: string;
  date: string; // ISO date
  readMinutes: number;
  body: string[]; // paragraphs — kept simple/static on purpose, no MDX/CMS
};

// Static on purpose (per the ask) — plain data, not a CMS. Every post
// below describes real app behavior, same accuracy bar as the FAQ.
export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "how-the-platform-fee-works",
    title: "How NanbaGO's platform fee actually works",
    excerpt:
      "NanbaGO isn't a taxi app — here's the real cost-sharing model behind every ride, and why the app never touches most of what you pay.",
    date: "2026-08-01",
    readMinutes: 4,
    body: [
      "The most common question we get is some version of \"wait, so how much does a ride actually cost?\" — and the honest answer is that NanbaGO is deliberately built differently from a taxi or ride-hailing app, so the usual mental model doesn't quite apply.",
      "A driver on NanbaGO is someone already making a trip with spare seats — not a commercial driver earning a fare. The per-kilometre rate they set is capped platform-wide specifically so it stays a cost-sharing contribution, not a profit margin. That whole amount is settled directly between passenger and driver, in cash or UPI, after the trip — it never passes through the app at all.",
      "What the app does charge, upfront, is a small platform fee — currently 10% of the fare — the moment a driver accepts your request. That fee is what funds the actual matching, the safety features (pickup verification, SOS, driver vetting), and the app itself. It's paid once, it locks your seat in, and it's the only figure that ever touches a payment gateway.",
      "If a driver cancels after you've paid, that fee is refunded in full, no exceptions, no timing rules — cancelling a paid booking is never something a passenger is penalized for. The two amounts are separate on purpose: one is the actual cost of the ride, kept between the two people sharing it; the other is what keeps the platform itself running.",
    ],
  },
  {
    slug: "five-safety-features-every-ride",
    title: "5 safety features built into every NanbaGO ride",
    excerpt:
      "From pickup verification to live SOS sharing, here's what's actually happening behind the scenes to keep every trip accountable.",
    date: "2026-07-20",
    readMinutes: 5,
    body: [
      "Safety isn't a settings toggle on NanbaGO — it's built into the shape of the booking flow itself, so it works whether or not anyone remembers to think about it in the moment. Here's what's actually running under the hood of every trip.",
      "1. Pickup verification, not just a name match. When your driver arrives, the app generates a one-time code that only appears on your screen. You read it aloud, they enter it — and the trip literally cannot start as IN_PROGRESS until that happens. It's a real handshake, not a formality.",
      "2. Emergency contacts set up in advance. You add the people who should be reachable if something goes wrong before you ever need them — so in an actual emergency, there's nothing left to configure, just one button.",
      "3. SOS with live location. That button shares your real-time GPS position with your emergency contacts immediately, not a delayed check-in.",
      "4. Vehicle-level driver verification. A driver's registration documents are reviewed before that specific vehicle can publish a single ride — not a one-time signup check that's stale a year later.",
      "5. Ratings that follow the account, not the trip. Every completed ride can be rated by both sides, and that history is visible on a profile before you ever agree to share a car with someone.",
      "None of these replace basic common sense — but they mean you're never relying on trust alone.",
    ],
  },
  {
    slug: "becoming-a-verified-driver",
    title: "How to become a verified NanbaGO driver",
    excerpt: "What you actually need, what gets checked, and how long it takes to go from signup to your first published ride.",
    date: "2026-07-10",
    readMinutes: 3,
    body: [
      "Offering rides on NanbaGO starts the same way riding does — verify your phone number, then choose driver mode from the side menu (or add it to an existing passenger account any time).",
      "From there, add your vehicle: make, model, registration number, and a photo of your registration certificate — a driving licence and a car photo are optional but help your listing and speed up trust from riders. Every field is reviewed against the actual document, not just recorded as text.",
      "That review typically finishes within an hour. You'll get a notification either way — approved, and you can publish rides on that vehicle immediately; not approved, and you'll see exactly why, with the option to fix the issue and resubmit rather than starting over.",
      "One thing worth knowing upfront: honoring accepted bookings matters. Repeated late cancellations or no-shows escalate through a warning system before any account action is taken — the bar is just showing up for rides you've committed to.",
    ],
  },
  {
    slug: "cancellation-and-refunds-explained",
    title: "NanbaGO's cancellation and refund policy, explained plainly",
    excerpt: "Who gets refunded, when, and why the rules are different depending on which side cancels and when.",
    date: "2026-06-28",
    readMinutes: 4,
    body: [
      "Cancellation policies are usually where apps bury the fine print — so here's the actual, complete version of how it works on NanbaGO, no asterisks.",
      "Before you've paid the platform fee: cancel freely, either side, any time, no penalty. Nothing was charged, so there's nothing to refund.",
      "Right after paying: there's a shared grace window (currently 30 minutes) where either passenger or driver can still back out penalty-free. It exists because plans genuinely change in the first few minutes after a booking locks in, and neither side should be punished for that.",
      "After the grace window: if the driver cancels, you're refunded in full regardless of timing — a driver backing out is never the passenger's fault, so it's never treated as one. If a passenger cancels this late, the platform fee isn't refunded, since the driver already turned away other requests to hold that seat for you.",
      "And if a driver simply never shows up: the app auto-cancels and refunds the booking once the no-show grace period passes the scheduled departure time — you don't need to file anything or wait on support to notice.",
      "Refunds themselves land within 3 working days of being initiated, and you can track the status from your booking the whole way through.",
    ],
  },
];
