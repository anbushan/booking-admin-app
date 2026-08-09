import crypto from "crypto";
import { redirect } from "next/navigation";
import { prisma } from "../../lib/prisma";

async function requestReset(formData: FormData) {
  "use server";
  const email = formData.get("email") as string;
  const admin = await prisma.adminUser.findUnique({ where: { email } });

  // Always redirect to the same "check your email" state whether or not
  // the account exists — don't leak which emails are registered admins.
  if (!admin) {
    redirect("/forgot-password?sent=1");
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  const resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.adminUser.update({
    where: { id: admin.id },
    data: { resetToken, resetTokenExpiresAt },
  });

  // TODO: send this via a real email provider (SES/SendGrid/Postmark).
  // No email infrastructure is configured in this scaffold — the link is
  // logged server-side instead so local development stays functional
  // without a mail server. Never do this in production.
  console.log(`Password reset link for ${email}: /reset-password?token=${resetToken}`);

  redirect("/forgot-password?sent=1");
}

export default function ForgotPasswordPage({ searchParams }: { searchParams: { sent?: string } }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", background: "#F1EFE8", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 340, background: "#fff", border: "1px solid #E3E1D8", borderRadius: 12, padding: 28 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Reset password</h1>

        {searchParams.sent ? (
          <p style={{ fontSize: 13, color: "#5F5E5A" }}>
            If that email belongs to an admin account, a reset link has
            been sent. In this dev environment (no email provider
            configured), check the server console log for the link
            instead.
          </p>
        ) : (
          <form action={requestReset} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input name="email" type="email" placeholder="you@company.com" required className="admin-input" style={{ height: 40 }} />
            <button type="submit" className="admin-btn admin-btn-primary" style={{ height: 42, width: "100%" }}>
              Send reset link
            </button>
          </form>
        )}

        <a href="/login" style={{ fontSize: 13, color: "#5F5E5A", marginTop: 16, display: "block" }}>
          Back to login
        </a>
      </div>
    </div>
  );
}
