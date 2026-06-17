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
let aiChatLogEnsuredPromise: Promise<void> | null = null;
let categoryAssetEnsuredPromise: Promise<void> | null = null;
let communityEnsuredPromise: Promise<void> | null = null;

/**
 * Honsell İcması cədvəllərini (CommunityPost + reaction + comment) ilk dəfə
 * lazım olanda yaradır — AiKnowledge ilə eyni ensure-once pattern (formal
 * migration əvəzinə, Supabase üçün).
 */
async function ensureCommunityTablesOnce(base: PrismaClient): Promise<void> {
  if (!communityEnsuredPromise) {
    communityEnsuredPromise = (async () => {
      try {
        await base.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "CommunityPost" (
            "id" TEXT PRIMARY KEY,
            "userId" TEXT NOT NULL,
            "category" TEXT NOT NULL DEFAULT 'GENERAL',
            "title" TEXT,
            "body" TEXT NOT NULL,
            "status" TEXT NOT NULL DEFAULT 'PENDING',
            "moderatedAt" TIMESTAMP(3),
            "moderatedById" TEXT,
            "moderationNote" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
        `);
        await base.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "CommunityPost_status_createdAt_idx"
          ON "CommunityPost" ("status", "createdAt");
        `);
        await base.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "CommunityPost_category_status_createdAt_idx"
          ON "CommunityPost" ("category", "status", "createdAt");
        `);
        await base.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "CommunityPost_userId_idx"
          ON "CommunityPost" ("userId");
        `);
        await base.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "CommunityPostReaction" (
            "postId" TEXT NOT NULL,
            "userId" TEXT NOT NULL,
            "value" INTEGER NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY ("postId", "userId")
          );
        `);
        await base.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "CommunityPostReaction_postId_value_idx"
          ON "CommunityPostReaction" ("postId", "value");
        `);
        await base.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "CommunityPostComment" (
            "id" TEXT PRIMARY KEY,
            "postId" TEXT NOT NULL,
            "userId" TEXT NOT NULL,
            "body" TEXT NOT NULL,
            "isHidden" BOOLEAN NOT NULL DEFAULT false,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
        `);
        await base.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "CommunityPostComment_postId_createdAt_idx"
          ON "CommunityPostComment" ("postId", "createdAt");
        `);
        await base.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "CommunityPostComment_userId_idx"
          ON "CommunityPostComment" ("userId");
        `);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!msg.includes("already exists")) {
          console.error("[Community schema ensure]", e);
        }
      }
    })();
  }
  await communityEnsuredPromise;
}

let streamingPlatformEnsuredPromise: Promise<void> | null = null;

/**
 * `StreamingPlatform` cədvəlini (dinamik streaming/music platformaları) ilk
 * dəfə lazım olanda yaradır — CategoryAsset ilə eyni ensure-once pattern
 * (formal migration əvəzinə, Supabase üçün).
 */
async function ensureStreamingPlatformTableOnce(base: PrismaClient): Promise<void> {
  if (!streamingPlatformEnsuredPromise) {
    streamingPlatformEnsuredPromise = (async () => {
      try {
        await base.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "StreamingPlatform" (
            "id" TEXT PRIMARY KEY,
            "code" TEXT NOT NULL,
            "slug" TEXT NOT NULL,
            "label" TEXT NOT NULL,
            "category" TEXT NOT NULL DEFAULT 'STREAMING',
            "tagline" TEXT NOT NULL DEFAULT '',
            "description" TEXT NOT NULL DEFAULT '',
            "sortOrder" INTEGER NOT NULL DEFAULT 0,
            "isActive" BOOLEAN NOT NULL DEFAULT true,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
        `);
        await base.$executeRawUnsafe(`
          ALTER TABLE "StreamingPlatform" ADD COLUMN IF NOT EXISTS "heroImageUrl" TEXT;
        `);
        await base.$executeRawUnsafe(`
          CREATE UNIQUE INDEX IF NOT EXISTS "StreamingPlatform_code_key" ON "StreamingPlatform" ("code");
        `);
        await base.$executeRawUnsafe(`
          CREATE UNIQUE INDEX IF NOT EXISTS "StreamingPlatform_slug_key" ON "StreamingPlatform" ("slug");
        `);
        await base.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "StreamingPlatform_isActive_sortOrder_idx"
          ON "StreamingPlatform" ("isActive", "sortOrder");
        `);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!msg.includes("already exists")) {
          console.error("[StreamingPlatform schema ensure]", e);
        }
      }
    })();
  }
  await streamingPlatformEnsuredPromise;
}

async function ensureCategoryAssetTableOnce(base: PrismaClient): Promise<void> {
  if (!categoryAssetEnsuredPromise) {
    categoryAssetEnsuredPromise = (async () => {
      try {
        await base.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "CategoryAsset" (
            "id" TEXT PRIMARY KEY,
            "key" TEXT NOT NULL,
            "label" TEXT NOT NULL,
            "description" TEXT,
            "href" TEXT NOT NULL,
            "imageUrl" TEXT,
            "isActive" BOOLEAN NOT NULL DEFAULT true,
            "sortOrder" INTEGER NOT NULL DEFAULT 0,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
        `);
        await base.$executeRawUnsafe(`
          CREATE UNIQUE INDEX IF NOT EXISTS "CategoryAsset_key_key" ON "CategoryAsset" ("key");
        `);
        await base.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "CategoryAsset_isActive_sortOrder_idx"
          ON "CategoryAsset" ("isActive", "sortOrder");
        `);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!msg.includes("already exists")) {
          console.error("[CategoryAsset schema ensure]", e);
        }
      }
    })();
  }
  await categoryAssetEnsuredPromise;
}

/**
 * `AiChatLog` cədvəlini (AI köməkçi söhbət logu) ilk dəfə lazım olanda yaradır
 * — AiKnowledge ilə eyni ensure-once pattern (formal migration əvəzinə).
 */
async function ensureAiChatLogTableOnce(base: PrismaClient): Promise<void> {
  if (!aiChatLogEnsuredPromise) {
    aiChatLogEnsuredPromise = (async () => {
      try {
        await base.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "AiChatLog" (
            "id" TEXT PRIMARY KEY,
            "userId" TEXT NOT NULL,
            "question" TEXT NOT NULL,
            "reply" TEXT NOT NULL,
            "productCount" INTEGER NOT NULL DEFAULT 0,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
        `);
        await base.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "AiChatLog_userId_idx" ON "AiChatLog" ("userId");
        `);
        await base.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "AiChatLog_createdAt_idx" ON "AiChatLog" ("createdAt");
        `);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!msg.includes("already exists")) {
          console.error("[AiChatLog schema ensure]", e);
        }
      }
    })();
  }
  await aiChatLogEnsuredPromise;
}

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
        if (model === "AiChatLog") {
          await ensureAiChatLogTableOnce(base);
        }
        if (model === "CategoryAsset") {
          await ensureCategoryAssetTableOnce(base);
        }
        if (model === "StreamingPlatform") {
          await ensureStreamingPlatformTableOnce(base);
        }
        if (
          model === "CommunityPost" ||
          model === "CommunityPostReaction" ||
          model === "CommunityPostComment"
        ) {
          await ensureCommunityTablesOnce(base);
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
