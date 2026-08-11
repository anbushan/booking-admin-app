import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "../../lib/prisma";
import { isRedirectError } from "../../lib/actionError";
import { PasswordInput } from "../../components/PasswordInput";
import { SubmitButton } from "../../components/SubmitButton";

async function resetPassword(formData: FormData) {
  "use server";
  const token = formData.get("token") as string;
  const password = formData.get("password") as string;

  try {
    const admin = await prisma.adminUser.findFirst({
      where: { resetToken: token, resetTokenExpiresAt: { gt: new Date() } },
    });

    if (!admin) {
      redirect("/reset-password?error=invalid");
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.adminUser.update({
      where: { id: admin.id },
      data: { passwordHash, resetToken: null, resetTokenExpiresAt: null },
    });

    redirect("/login?reset=1");
  } catch (err) {
    if (isRedirectError(err)) throw err;
    redirect(`/reset-password?token=${encodeURIComponent(token)}&error=server`);
  }
}

export default function ResetPasswordPage({ searchParams }: { searchParams: { token?: string; error?: string } }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", background: "#F1EFE8", padding: 16 }}>
      <form
        action={resetPassword}
        style={{ width: "100%", maxWidth: 340, display: "flex", flexDirection: "column", gap: 12, background: "#fff", border: "1px solid #E3E1D8", borderRadius: 12, padding: 28 }}
      >
        <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Set a new password</h1>
        {searchParams.error && (
          <p style={{ color: "#A32D2D", fontSize: 13, background: "#FCEBEB", borderRadius: 6, padding: "8px 10px", margin: 0 }}>
            {searchParams.error === "server"
              ? "Something went wrong. Please try again."
              : "That reset link is invalid or has expired. Request a new one."}
          </p>
        )}
        <input type="hidden" name="token" value={searchParams.token || ""} />
        <PasswordInput name="password" placeholder="New password" required minLength={8} autoComplete="new-password" />
        <SubmitButton className="admin-btn admin-btn-primary" pendingLabel="Saving..." style={{ height: 42, width: "100%" }}>
          Set password
        </SubmitButton>
      </form>
    </div>
  );
}
