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
let aiKnowledgeEnsuredPromise: Promise<void> | null = null;
let productGiftEnsuredPromise: Promise<void> | null = null;

/**
 * `AiKnowledge` cədvəlini (AI köməkçi bilik bazası) ilk dəfə lazım olanda
 * yaradır. Formal prisma migration əvəzinə — kodbazanın digər ensure-once
 * pattern-i (referral/cashback sütunları) ilə eyni üsul.
 */
async function ensureAiKnowledgeTableOnce(base: PrismaClient): Promise<void> {
  if (!aiKnowledgeEnsuredPromise) {
    aiKnowledgeEnsuredPromise = (async () => {
      try {
        await base.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "AiKnowledge" (
            "id" TEXT PRIMARY KEY,
            "title" TEXT NOT NULL,
            "content" TEXT NOT NULL,
            "category" TEXT NOT NULL DEFAULT 'GENERAL',
            "isActive" BOOLEAN NOT NULL DEFAULT true,
            "sortOrder" INTEGER NOT NULL DEFAULT 0,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
        `);
        await base.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "AiKnowledge_isActive_sortOrder_idx"
          ON "AiKnowledge" ("isActive", "sortOrder");
        `);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!msg.includes("already exists")) {
          console.error("[AiKnowledge schema ensure]", e);
        }
      }
    })();
  }
  await aiKnowledgeEnsuredPromise;
}

/**
 * `ProductGift` cədvəlini (məhsulu dostuna hədiyyə et) ilk dəfə lazım olanda
 * yaradır — AiKnowledge ilə eyni ensure-once pattern (formal migration əvəzinə).
 */
async function ensureProductGiftTableOnce(base: PrismaClient): Promise<void> {
  if (!productGiftEnsuredPromise) {
    productGiftEnsuredPromise = (async () => {
      try {
        await base.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "ProductGift" (
            "id" TEXT PRIMARY KEY,
            "code" TEXT NOT NULL,
            "status" TEXT NOT NULL DEFAULT 'UNCLAIMED',
            "productKind" TEXT NOT NULL,
            "gameId" TEXT,
            "serviceProductId" TEXT,
            "store" TEXT,
            "titleSnap" TEXT NOT NULL,
            "imageSnap" TEXT,
            "amountAznCents" INTEGER NOT NULL,
            "giftMessage" TEXT,
            "purchasedById" TEXT NOT NULL,
            "purchaseTransactionId" TEXT,
            "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "claimedById" TEXT,
            "claimedAt" TIMESTAMP(3),
            "fulfillmentTransactionId" TEXT,
            "expiresAt" TIMESTAMP(3) NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
        `);
        await base.$executeRawUnsafe(`
          CREATE UNIQUE INDEX IF NOT EXISTS "ProductGift_code_key" ON "ProductGift" ("code");
        `);
        await base.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "ProductGift_status_expiresAt_idx" ON "ProductGift" ("status", "expiresAt");
        `);
        await base.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "ProductGift_purchasedById_idx" ON "ProductGift" ("purchasedById");
        `);
        await base.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "ProductGift_claimedById_idx" ON "ProductGift" ("claimedById");
        `);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!msg.includes("already exists")) {
          console.error("[ProductGift schema ensure]", e);
        }
      }
    })();
  }
  await productGiftEnsuredPromise;
}

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
        if (model === "AiKnowledge") {
          await ensureAiKnowledgeTableOnce(base);
        }
        if (model === "ProductGift") {
          await ensureProductGiftTableOnce(base);
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
