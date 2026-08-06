import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "../../lib/prisma";

async function resetPassword(formData: FormData) {
  "use server";
  const token = formData.get("token") as string;
  const password = formData.get("password") as string;

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
}

export default function ResetPasswordPage({ searchParams }: { searchParams: { token?: string; error?: string } }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif", padding: 16 }}>
      <form action={resetPassword} style={{ width: "100%", maxWidth: 320, display: "flex", flexDirection: "column", gap: 12 }}>
        <h1 style={{ fontSize: 18, fontWeight: 500, marginBottom: 8 }}>Set a new password</h1>
        {searchParams.error && (
          <p style={{ color: "#A32D2D", fontSize: 13 }}>
            That reset link is invalid or has expired. Request a new one.
          </p>
        )}
        <input type="hidden" name="token" value={searchParams.token || ""} />
        <input
          name="password"
          type="password"
          placeholder="New password"
          required
          minLength={8}
          style={{ height: 40, border: "1px solid #E3E1D8", borderRadius: 6, padding: "0 10px" }}
        />
        <button
          type="submit"
          style={{ height: 42, background: "#1A1A18", color: "#fff", border: "none", borderRadius: 6, fontSize: 14 }}
        >
          Set password
        </button>
      </form>
    </div>
  );
}
