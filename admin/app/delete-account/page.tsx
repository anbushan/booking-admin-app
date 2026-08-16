import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckCircle2, Smartphone, Mail } from "lucide-react";
import { MarketingShell } from "../../components/MarketingShell";
import { SITE_URL, BRAND_NAME, CONTACT_EMAIL } from "../../lib/siteContent";

const TITLE = "Delete your account";
const DESCRIPTION = `How to delete your ${BRAND_NAME} account and data, in the app or from here if you don't have it installed.`;

export const metadata: Metadata = {
  title: `${TITLE} — ${BRAND_NAME}`,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/delete-account` },
  openGraph: { title: `${TITLE} — ${BRAND_NAME}`, description: DESCRIPTION, url: `${SITE_URL}/delete-account`, siteName: BRAND_NAME, type: "website" },
};

// Google Play's User Data policy requires this exact thing: a way to
// request account deletion that doesn't depend on having the app
// installed. The in-app path (Settings → Delete account) is faster
// when it's available — OTP-verified, immediate — so it's presented
// first; this form is the fallback for someone who's already
// uninstalled, lost access to their number's SIM, or just prefers web.
// Posts to backend's unauthenticated POST /api/users/request-deletion,
// which queues the request for an admin to verify and action (see
// AccountDeletionRequest's schema comment) rather than deleting
// outright — a web form has no way to prove who's actually asking,
// unlike the in-app flow's authenticated session.
async function requestDeletion(formData: FormData) {
  "use server";
  const phone = (formData.get("phone") as string || "").replace(/\D/g, "");
  const reason = (formData.get("reason") as string || "").trim();

  if (!/^\d{10}$/.test(phone)) {
    redirect("/delete-account?error=phone");
  }

  try {
    const res = await fetch(`${process.env.BACKEND_API_URL}/api/users/request-deletion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, reason: reason || undefined }),
    });
    if (res.status === 429) {
      redirect("/delete-account?error=duplicate");
    }
    if (!res.ok) {
      redirect("/delete-account?error=failed");
    }
  } catch {
    redirect("/delete-account?error=failed");
  }

  redirect("/delete-account?submitted=1");
}

const ERROR_MESSAGES: Record<string, string> = {
  phone: "Enter a valid 10-digit phone number.",
  duplicate: "A request for this number was already submitted recently — we'll be in touch.",
  failed: "Something went wrong submitting this. Try again, or email us instead.",
};

export default function DeleteAccountPage({ searchParams }: { searchParams: { submitted?: string; error?: string } }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `${TITLE} — ${BRAND_NAME}`,
    url: `${SITE_URL}/delete-account`,
  };

  return (
    <MarketingShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <section className="mkt-section-tight">
        <span className="mkt-eyebrow">Your data, your call</span>
        <h1 className="mkt-h1" style={{ fontSize: "clamp(28px, 4vw, 40px)" }}>{TITLE}</h1>
        <p className="mkt-lede" style={{ maxWidth: "none" }}>
          You can delete your {BRAND_NAME} account and its data whether or not the app is installed. Deleting
          removes your profile info — other people's ride and rating history stays intact, just without
          anything left that identifies it as yours. See the{" "}
          <a href="/legal/privacy" style={{ color: "#0C447C" }}>Privacy Policy</a> for exactly what's kept and why.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 32 }}>
          <div className="mkt-card" style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
            <div className="mkt-card-icon" style={{ background: "#EAF3DE", marginBottom: 0, flexShrink: 0 }}>
              <Smartphone size={20} color="#3B6D11" />
            </div>
            <div>
              <h3 style={{ margin: 0 }}>Have the app installed? Use it — it's instant.</h3>
              <p style={{ margin: "4px 0 0" }}>
                Open {BRAND_NAME}, go to Settings → Delete account. It's OTP-verified against your own session, so
                it can confirm and complete right away — no waiting on this form.
              </p>
            </div>
          </div>

          <div className="mkt-card" style={{ padding: 24 }}>
            <h3 style={{ margin: "0 0 4px" }}>Don't have the app anymore? Request it here.</h3>
            <p style={{ margin: "0 0 20px" }}>
              We'll verify it's really you (a callback to the number below) before deleting anything — usually
              within a few business days.
            </p>

            {searchParams.submitted ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#EAF3DE", borderRadius: 8, padding: "12px 16px" }}>
                <CheckCircle2 size={18} color="#3B6D11" />
                <span style={{ fontSize: 14, color: "#3B6D11" }}>Request received — we'll follow up on that number.</span>
              </div>
            ) : (
              <form action={requestDeletion} style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 380 }}>
                {searchParams.error && (
                  <div style={{ fontSize: 13, color: "#A32D2D", background: "#FCEBEB", borderRadius: 8, padding: "10px 14px" }}>
                    {ERROR_MESSAGES[searchParams.error] || ERROR_MESSAGES.failed}
                  </div>
                )}
                <label style={{ fontSize: 13, fontWeight: 500 }}>
                  Phone number on the account
                  <input
                    type="tel"
                    name="phone"
                    required
                    placeholder="10-digit mobile number"
                    className="admin-input"
                    style={{ marginTop: 6, width: "100%" }}
                  />
                </label>
                <label style={{ fontSize: 13, fontWeight: 500 }}>
                  Reason (optional)
                  <input
                    type="text"
                    name="reason"
                    placeholder="Just switching apps, no longer needed, etc."
                    className="admin-input"
                    style={{ marginTop: 6, width: "100%" }}
                  />
                </label>
                <button type="submit" className="admin-btn admin-btn-primary" style={{ marginTop: 8, alignSelf: "flex-start" }}>
                  Request deletion
                </button>
              </form>
            )}
          </div>

          <div className="mkt-card" style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div className="mkt-card-icon" style={{ background: "#E6F1FB", marginBottom: 0, flexShrink: 0 }}>
              <Mail size={20} color="#0C447C" />
            </div>
            <div>
              <h3 style={{ margin: 0 }}>Prefer email?</h3>
              <p style={{ margin: "4px 0 0" }}>
                Write to <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: "#0C447C" }}>{CONTACT_EMAIL}</a> from
                the address or number on your account and we'll handle it the same way.
              </p>
            </div>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
