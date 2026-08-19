import { PrismaClient } from "@prisma/client";
import { invalidateUserCache } from "./userCache.js";

// Single shared instance — avoids exhausting Postgres connections
// when the dev server hot-reloads.
const basePrisma = new PrismaClient();

// Structural cache invalidation for userCache.js: every write to User,
// through any route, goes through this one extended client (the only
// `prisma` this codebase imports), so requireAuth's short-TTL cache
// never needs each individual call site to remember to invalidate it.
// Reads the affected id off the *result* rather than `args.where` —
// update()/upsert() return the row (so `.id` is always there regardless
// of which unique field the caller matched on), and updateMany/
// deleteMany only return a count, so those clear the whole cache instead
// (rare — no route currently bulk-updates Users, but safe either way).
export const prisma = basePrisma.$extends({
  query: {
    user: {
      async $allOperations({ operation, args, query }) {
        const result = await query(args);
        if (["update", "upsert", "delete"].includes(operation) && result?.id) {
          await invalidateUserCache(result.id);
        } else if (["updateMany", "deleteMany"].includes(operation)) {
          await invalidateUserCache(); // no id to target — caller passes none, clears everything
        }
        return result;
      },
    },
  },
});
