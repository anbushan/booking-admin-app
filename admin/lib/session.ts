import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const COOKIE_NAME = "admin_session";

export function issueSessionCookie(payload: { adminId: string; role: string }) {
  const token = jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: "12h" });
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 12,
    path: "/",
  });
}

export function getSession(): { adminId: string; role: string } | null {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET!) as { adminId: string; role: string };
  } catch {
    return null;
  }
}

export function clearSession() {
  cookies().delete(COOKIE_NAME);
}

// Call at the top of any page/action that needs a specific role.
// super_admin always passes; everything else must be explicitly listed.
export function requireRole(session: { role: string } | null, allowed: string[]) {
  if (!session) return false;
  if (session.role === "super_admin") return true;
  return allowed.includes(session.role);
}
