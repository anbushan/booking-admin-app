import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";
import { getCachedUser, setCachedUser } from "../lib/userCache.js";

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Not authenticated." });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // Runs on nearly every request — a short-TTL cache (see userCache.js
    // for the invalidation story) turns the mobile app's frequent
    // polling of the same user's endpoints into one DB round trip every
    // few seconds instead of one per request.
    let user = getCachedUser(payload.userId);
    if (!user) {
      user = await prisma.user.findUnique({ where: { id: payload.userId } });
      if (user) setCachedUser(user);
    }
    if (!user || user.disabled) {
      return res.status(403).json({ error: "Account unavailable." });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired session." });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Not permitted for this role." });
    }
    next();
  };
}
