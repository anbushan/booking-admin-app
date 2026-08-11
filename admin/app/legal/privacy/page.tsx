export const metadata = {
  title: "Privacy Policy — NanbaGO",
  description: "What NanbaGO collects, why, and how to control or delete it.",
};

const LAST_UPDATED = "11 August 2026";
const CONTACT_EMAIL = "anbushanthi001@gmail.com";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 10 }}>{title}</h2>
      <div style={{ fontSize: 14.5, lineHeight: 1.7, color: "#3A382F" }}>{children}</div>
    </section>
  );
}

function Row({ what, why }: { what: string; why: string }) {
  return (
    <div style={{ display: "flex", gap: 14, padding: "10px 0", borderBottom: "1px solid #F0EEE6" }}>
      <div style={{ flex: "0 0 38%", fontWeight: 600 }}>{what}</div>
      <div style={{ flex: 1, color: "#5A5748" }}>{why}</div>
    </div>
  );
}

export default function PrivacyPage() {
  return (
    <article>
      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 6 }}>Privacy Policy</h1>
      <p style={{ fontSize: 13, color: "#8A8776" }}>Last updated {LAST_UPDATED}</p>

      <p style={{ fontSize: 14.5, lineHeight: 1.7, color: "#3A382F", marginTop: 20 }}>
        This explains what information NanbaGO collects, why, who we share it with, and the
        controls you have — including deleting your account entirely.
      </p>

      <Section title="Information we collect">
        <div style={{ marginTop: 4 }}>
          <Row what="Phone number" why="Your account identity and login — verified by OTP or a passcode you set." />
          <Row what="Name, email (optional)" why="Shown to the other side of a booking so they know who they're meeting." />
          <Row what="Profile photo (optional)" why="Shown to the other side of a booking for a face to match on pickup." />
          <Row what="Pickup/drop location, live GPS during a trip" why="To match rides going your way, and for live tracking and safety (SOS) while a trip is in progress." />
          <Row what="Vehicle details & documents (RC, licence, vehicle photo)" why="Required for a driver's vehicle to be verified before it can be used to publish rides." />
          <Row what="Chat messages" why="Only visible between a driver and passenger with an active, confirmed booking — deleted once that booking ends." />
          <Row what="Payment metadata" why="The platform fee is processed by Razorpay; we never see or store your card, UPI PIN, or full payment details ourselves." />
          <Row what="Emergency contacts (optional)" why="So we can reach someone on your behalf if you use the SOS feature." />
          <Row what="Device push token" why="To deliver booking, payment, and trip notifications." />
          <Row what="App usage events" why="Which screens are used and how often, to find and fix problems and improve the app." />
        </div>
      </Section>

      <Section title="How we use it">
        <p>
          To match and confirm rides, verify drivers and vehicles before they can publish trips,
          process the platform-fee payment, enable live trip tracking and the SOS safety feature,
          send you notifications about your bookings, and understand how the app is actually used
          so we can fix what&rsquo;s broken and improve what isn&rsquo;t. We don&rsquo;t sell your
          personal information.
        </p>
      </Section>

      <Section title="Who we share it with">
        <p>
          Only the service providers that make the app work, each only for that specific purpose:
        </p>
        <ul style={{ marginTop: 8, paddingLeft: 20 }}>
          <li><strong>Razorpay</strong> — processes the in-app platform-fee payment.</li>
          <li><strong>Google / Firebase</strong> — delivers push notifications and powers in-app
            analytics, and Google Maps/Places resolves addresses and routes.</li>
          <li><strong>Cloudflare R2</strong> — stores uploaded documents and photos in a private
            bucket; files are only ever accessible via a short-lived link generated when you or an
            authorised reviewer actually needs to view one.</li>
        </ul>
        <p style={{ marginTop: 10 }}>
          The other person in a booking sees your name, rating, and (if you added one) your
          profile photo — never your raw phone number directly in chat, though calling a
          confirmed booking's other party does connect your real numbers today (see the in-app
          call feature).
        </p>
      </Section>

      <Section title="How long we keep it">
        <p>
          Chat messages are deleted once a booking's active window ends. Verification documents
          are kept while your account and vehicle remain active, for compliance and dispute
          purposes. Trip and booking records are retained after a trip completes to support
          ratings, safety investigations, refunds, and legal/financial record-keeping — the same
          way most transaction records are kept.
        </p>
      </Section>

      <Section title="Your controls, and deleting your account">
        <p>
          You can edit your profile, change your photo, and change your WhatsApp/notification
          preferences at any time from the app. You can also delete your account from
          Settings → Delete account. When you do:
        </p>
        <ul style={{ marginTop: 8, paddingLeft: 20 }}>
          <li>Your name, email, profile photo, and push token are permanently removed.</li>
          <li>Your account is deactivated and you can no longer log in with that number.</li>
          <li>
            Past trip and booking records tied to other users (fares, ratings, trip history) are
            kept in a de-identified form — we don&rsquo;t delete another user&rsquo;s history of a
            trip they took with you, but it no longer identifies you personally.
          </li>
        </ul>
        <p style={{ marginTop: 10 }}>
          If you have an active booking, a published ride, or a refund in progress, you&rsquo;ll
          need to resolve it first — the app tells you exactly what, if anything, is blocking
          deletion before you confirm.
        </p>
      </Section>

      <Section title="Security">
        <p>
          Data in transit is encrypted (HTTPS). Uploaded documents and photos live in a private
          storage bucket, never publicly reachable — every view goes through a short-lived,
          purpose-specific link generated on demand.
        </p>
      </Section>

      <Section title="Children">
        <p>NanbaGO is not intended for anyone under 18, and we don&rsquo;t knowingly collect data from minors.</p>
      </Section>

      <Section title="Changes to this policy">
        <p>
          If we make a material change to this policy, we&rsquo;ll update the &ldquo;Last
          updated&rdquo; date above.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions, or want to exercise a data right not covered above? Reach us at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: "#185FA5" }}>{CONTACT_EMAIL}</a>.
        </p>
      </Section>
    </article>
  );
}
