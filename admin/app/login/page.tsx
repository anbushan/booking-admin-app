import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "../../lib/prisma";
import { getSession, issueSessionCookie } from "../../lib/session";
import { Logo } from "../../components/Logo";

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
    <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", background: "#F1EFE8", padding: 16 }}>
      <form
        action={login}
        style={{
          width: "100%",
          maxWidth: 340,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          background: "#fff",
          border: "1px solid #E3E1D8",
          borderRadius: 12,
          padding: 28,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <Logo size={32} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#0C447C" }}>NanbaGO</div>
            <div style={{ fontSize: 12, color: "#888780" }}>Admin</div>
          </div>
        </div>
        {searchParams.error && (
          <p style={{ color: "#A32D2D", fontSize: 13, background: "#FCEBEB", borderRadius: 6, padding: "8px 10px", margin: 0 }}>
            Invalid email or password.
          </p>
        )}
        <input name="email" type="email" placeholder="you@company.com" required className="admin-input" style={{ height: 40 }} />
        <input name="password" type="password" placeholder="Password" required className="admin-input" style={{ height: 40 }} />
        <button type="submit" className="admin-btn admin-btn-primary" style={{ height: 42, width: "100%" }}>
          Sign in
        </button>
        <a href="/forgot-password" style={{ fontSize: 13, color: "#5F5E5A", textAlign: "center" }}>
          Forgot password?
        </a>
      </form>
    </div>
  );
}
