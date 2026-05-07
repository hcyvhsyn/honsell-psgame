import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __prismaBase: ReturnType<typeof createBasePrismaClient> | undefined;
  // eslint-disable-next-line no-var
  var __prisma: ReturnType<typeof buildPrismaClient> | undefined;
}

function createBasePrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const pool = new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 10_000,
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

let referralEnsuredPromise: Promise<void> | null = null;
let cashbackEnsuredPromise: Promise<void> | null = null;

async function ensureReferralBalanceColumnOnce(base: PrismaClient): Promise<void> {
  if (!referralEnsuredPromise) {
    referralEnsuredPromise = base
      .$executeRawUnsafe(`
        ALTER TABLE "User"
        ADD COLUMN IF NOT EXISTS "referralBalanceCents" INTEGER NOT NULL DEFAULT 0;
      `)
      .then(() => undefined)
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        if (
          msg.includes("already exists") ||
          msg.includes("duplicate column") ||
          msg.includes("duplicateColumn")
        ) {
          return;
        }
        console.error("[referralBalanceCents schema ensure]", e);
      });
  }
  await referralEnsuredPromise;
}

async function ensureCashbackBalanceColumnOnce(base: PrismaClient): Promise<void> {
  if (!cashbackEnsuredPromise) {
    cashbackEnsuredPromise = base
      .$executeRawUnsafe(`
        ALTER TABLE "User"
        ADD COLUMN IF NOT EXISTS "cashbackBalanceCents" INTEGER NOT NULL DEFAULT 0;
      `)
      .then(() => undefined)
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        if (
          msg.includes("already exists") ||
          msg.includes("duplicate column") ||
          msg.includes("duplicateColumn")
        ) {
          return;
        }
        console.error("[cashbackBalanceCents schema ensure]", e);
      });
  }
  await cashbackEnsuredPromise;
}

function buildPrismaClient() {
  const base = globalThis.__prismaBase ?? createBasePrismaClient();
  if (process.env.NODE_ENV !== "production") {
    globalThis.__prismaBase = base;
  }

  const extended = base.$extends({
    query: {
      async $allOperations({ model, args, query }) {
        if (model === "User") {
          await ensureReferralBalanceColumnOnce(base);
          await ensureCashbackBalanceColumnOnce(base);
        }
        return query(args);
      },
    },
  });

  return extended;
}

/** İlk `User` sorğusu əvvəl `referralBalanceCents` sütununu Lazım isə əlavə edir. */
export const prisma = globalThis.__prisma ?? buildPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}
