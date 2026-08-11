export const metadata = {
  title: "Terms of Service — NanbaGO",
  description: "The terms that govern using the NanbaGO carpooling app.",
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

export default function TermsPage() {
  return (
    <article>
      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 6 }}>Terms of Service</h1>
      <p style={{ fontSize: 13, color: "#8A8776" }}>Last updated {LAST_UPDATED}</p>

      <p style={{ fontSize: 14.5, lineHeight: 1.7, color: "#3A382F", marginTop: 20 }}>
        These Terms govern your use of the NanbaGO mobile app and the services it provides. By
        creating an account or using NanbaGO, you agree to these Terms. If you don&rsquo;t agree,
        please don&rsquo;t use the app.
      </p>

      <Section title="1. What NanbaGO is">
        <p>
          NanbaGO is a carpooling platform that connects drivers who have spare seats on a trip
          they&rsquo;re already making with passengers travelling the same way, to share the
          cost of the journey. NanbaGO is <strong>not</strong> a taxi, cab-hailing, or public
          transportation service. We don&rsquo;t own vehicles, employ drivers, or operate as a
          common carrier. Drivers publish trips they intend to make for their own purposes;
          passengers request seats on those trips. NanbaGO provides the platform that makes that
          connection, verification, and payment of the platform fee possible.
        </p>
      </Section>

      <Section title="2. Eligibility and your account">
        <p>
          You must be at least 18 years old and able to form a binding contract to use NanbaGO.
          You sign in with your mobile number, verified by a one-time code (or an optional
          six-digit passcode you set up afterwards). You&rsquo;re responsible for keeping access
          to your phone number and passcode secure, and for all activity under your account.
        </p>
        <p style={{ marginTop: 10 }}>
          A single phone number may register as either a passenger or a driver, and switch
          between the two, but always corresponds to one account and one identity on the
          platform.
        </p>
      </Section>

      <Section title="3. Driving on NanbaGO">
        <p>
          To publish a ride, a driver must add a vehicle and submit its registration certificate
          (RC), a photo, and (optionally) a driving licence for review. A vehicle can only be used
          to publish rides once our team has approved it. We may reject a submission — with a
          reason shown in the app — and ask for it to be corrected and resubmitted. We may also
          suspend a driver&rsquo;s ability to publish rides if documents expire, a vehicle is
          reported unsafe, or a driver&rsquo;s conduct violates these Terms.
        </p>
        <p style={{ marginTop: 10 }}>
          Drivers are solely responsible for holding a valid driving licence, vehicle registration,
          and insurance as required by law, for the roadworthiness of their vehicle, and for
          complying with all applicable traffic and transport regulations. Verifying a document
          confirms it was reviewed and approved by our team — it is not a guarantee of a
          driver&rsquo;s skill, and does not make NanbaGO the employer or principal of any driver.
        </p>
      </Section>

      <Section title="4. Booking, the platform fee, and the rest of the fare">
        <p>
          A passenger requests seats on a published ride; the driver accepts or declines. Once
          accepted, the passenger has a limited window to pay a platform fee in-app, processed by
          our payment partner, Razorpay — this is what confirms the seat. The <strong>remaining
          fare</strong> for the trip is agreed and settled directly between the passenger and
          driver, in cash or via UPI, outside the app. NanbaGO is not a party to that payment,
          does not collect it, and cannot guarantee, refund, or resolve disputes about it — any
          disagreement over the remaining fare is between the passenger and driver.
        </p>
        <p style={{ marginTop: 10 }}>
          Cancellation windows, refund eligibility for the platform fee, and any cooldown applied
          for repeated late cancellations are shown in-app at the relevant step and may be updated
          from time to time.
        </p>
      </Section>

      <Section title="5. Conduct and safety">
        <p>
          NanbaGO includes safety features — ratings and reviews after each trip, optional
          emergency contacts, an in-trip SOS option, and live location sharing during an active
          trip — to help both sides make informed decisions and get help quickly if something
          goes wrong. These features support your safety; they don&rsquo;t guarantee it. You are
          responsible for exercising your own judgment about who you choose to ride with.
        </p>
        <p style={{ marginTop: 10 }}>
          You agree not to use NanbaGO for any unlawful purpose, to harass, threaten, or
          discriminate against another user, to publish false ride information, to circumvent
          verification, or to use the platform for any purpose other than genuine ride-sharing.
        </p>
      </Section>

      <Section title="6. Communication in the app">
        <p>
          Chat and calling within the app are available only between a driver and passenger with
          an active, confirmed booking, and stop being accessible once that booking ends — this is
          to support coordinating a specific trip, not general messaging. Please keep it civil and
          on-topic.
        </p>
      </Section>

      <Section title="7. Suspension and termination">
        <p>
          We may suspend or terminate access to an account that violates these Terms, provides
          false information, fails verification, or poses a safety risk to other users. You may
          stop using NanbaGO, or delete your account, at any time from Settings in the app.
        </p>
      </Section>

      <Section title="8. Disclaimers and limitation of liability">
        <p>
          NanbaGO is provided &ldquo;as is.&rdquo; We do our best to verify drivers and their
          vehicles, but we don&rsquo;t control how any user actually drives, behaves, or fulfils
          a trip once it&rsquo;s underway. To the fullest extent permitted by law, NanbaGO is not
          liable for any accident, injury, loss, dispute, or damage arising from a ride arranged
          through the platform, including disputes over the cash/UPI portion of a fare settled
          directly between users.
        </p>
      </Section>

      <Section title="9. Changes to these Terms">
        <p>
          We may update these Terms from time to time. If we make a material change, we&rsquo;ll
          update the &ldquo;Last updated&rdquo; date above. Continuing to use NanbaGO after a
          change means you accept the updated Terms.
        </p>
      </Section>

      <Section title="10. Governing law">
        <p>These Terms are governed by the laws of India.</p>
      </Section>

      <Section title="11. Contact">
        <p>
          Questions about these Terms? Reach us at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: "#185FA5" }}>{CONTACT_EMAIL}</a>.
        </p>
      </Section>
    </article>
  );
}
