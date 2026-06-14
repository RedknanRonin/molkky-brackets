import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// This DB is shared with another app; we live in the `molkky` Postgres schema.
const SCHEMA = "molkky";

function createClient() {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error("DATABASE_URL is not set");
  }

  // Strip `sslmode`/`schema`: pg parses `sslmode` as verify-full, which would
  // override our ssl option below (Aiven uses a self-signed CA). The schema is
  // passed to the adapter explicitly so Prisma qualifies table names correctly.
  const url = new URL(raw);
  url.searchParams.delete("sslmode");
  url.searchParams.delete("schema");

  const adapter = new PrismaPg(
    {
      connectionString: url.toString(),
      // Aiven requires SSL; we don't ship the CA, so encrypt without strict verify.
      ssl: { rejectUnauthorized: false },
    },
    { schema: SCHEMA },
  );

  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createClient> | undefined;
};

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
