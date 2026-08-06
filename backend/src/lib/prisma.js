import { PrismaClient } from "@prisma/client";

// Single shared instance — avoids exhausting Postgres connections
// when the dev server hot-reloads.
export const prisma = new PrismaClient();
