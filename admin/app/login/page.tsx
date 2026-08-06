import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "../../lib/prisma";
import { getSession, issueSessionCookie } from "../../lib/session";

async function login(formData: FormData) {
  "use server";
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const admin = await prisma.adminUser.findUnique({ where: { email } });
  if (!admin) redirect("/login?error=1");

  const valid = await bcrypt.compare(password, admin.passwordHash);
  if (!valid) redirect("/login?error=1");

  const roleRecord = await prisma.adminRole.findFirst({ where: { adminId: admin.id } });
  issueSessionCookie({ adminId: admin.id, role: roleRecord?.role || "support" });
  redirect("/dashboard");
}

export default function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  // Already signed in — the login form has nothing to offer someone with
  // a valid session, so skip straight to the dashboard instead of making
  // them look at (or worse, re-submit through) the login form again.
  if (getSession()) redirect("/dashboard");

  return (
    <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif", padding: 16 }}>
      <form action={login} style={{ width: "100%", maxWidth: 320, display: "flex", flexDirection: "column", gap: 12 }}>
        <h1 style={{ fontSize: 18, fontWeight: 500, marginBottom: 8 }}>Admin login</h1>
        {searchParams.error && (
          <p style={{ color: "#A32D2D", fontSize: 13 }}>Invalid email or password.</p>
        )}
        <input
          name="email"
          type="email"
          placeholder="you@company.com"
          required
          style={{ height: 40, border: "1px solid #E3E1D8", borderRadius: 6, padding: "0 10px" }}
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          required
          style={{ height: 40, border: "1px solid #E3E1D8", borderRadius: 6, padding: "0 10px" }}
        />
        <button
          type="submit"
          style={{ height: 42, background: "#1A1A18", color: "#fff", border: "none", borderRadius: 6, fontSize: 14 }}
        >
          Sign in
        </button>
        <a href="/forgot-password" style={{ fontSize: 13, color: "#5F5E5A", textAlign: "center" }}>
          Forgot password?
        </a>
      </form>
    </div>
  );
}
