import { prisma } from "@/lib/prisma";
import {
  WINNER_SOURCES,
  SELECTION_METHODS,
  REVIEW_SOURCES,
  REVIEW_ENTRY_METHODS,
  REVIEW_STATUSES,
  withinWinnerLimit,
  type WinnerSource,
  type SelectionMethod,
  type ReviewSource,
  type ReviewEntryMethod,
  type ReviewStatus,
} from "@/lib/giveawayWinnersShared";

/**
 * Çəkiliş qalibləri + rəyləri üçün SERVER (prisma) məntiqi: audit, validasiya,
 * transaction daxilində qalib limiti yoxlaması, entry → qalib körpüsü.
 * Client-safe hissə `@/lib/giveawayWinnersShared`-dədir.
 */

// Prisma transaction client tipi (tx və ya prisma özü qəbul edilir).
type Db = Pick<typeof prisma, "giveawayWinner" | "giveaway" | "giveawayEntry">;

// ─── Validasiya ───────────────────────────────────────────────────────────────

export const isWinnerSource = (v: unknown): v is WinnerSource =>
  typeof v === "string" && (WINNER_SOURCES as readonly string[]).includes(v);
export const isSelectionMethod = (v: unknown): v is SelectionMethod =>
  typeof v === "string" && (SELECTION_METHODS as readonly string[]).includes(v);
export const isReviewSource = (v: unknown): v is ReviewSource =>
  typeof v === "string" && (REVIEW_SOURCES as readonly string[]).includes(v);
export const isReviewEntryMethod = (v: unknown): v is ReviewEntryMethod =>
  typeof v === "string" && (REVIEW_ENTRY_METHODS as readonly string[]).includes(v);
export const isReviewStatus = (v: unknown): v is ReviewStatus =>
  typeof v === "string" && (REVIEW_STATUSES as readonly string[]).includes(v);

// ─── Audit ────────────────────────────────────────────────────────────────────

/**
 * Çəkiliş qalib/rəy əməliyyatını audit izinə yazır. Uğursuzluqda səssizcə
 * loglayıb davam edir — audit əsas əməliyyatı dayandırmamalıdır.
 */
export async function logGiveawayAudit(input: {
  actorId: string | null;
  giveawayId: string | null;
  entityType: "winner" | "review";
  entityId: string;
  action: string;
  prev?: unknown;
  next?: unknown;
}): Promise<void> {
  try {
    const cap = (v: unknown): string | null =>
      v == null ? null : JSON.stringify(v).slice(0, 8000);
    await prisma.giveawayAuditLog.create({
      data: {
        actorId: input.actorId,
        giveawayId: input.giveawayId,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        prevData: cap(input.prev),
        newData: cap(input.next),
      },
    });
  } catch (err) {
    console.error("[giveawayAudit] failed to log:", err);
  }
}

// ─── Limit ────────────────────────────────────────────────────────────────────

/** Bu çəkiliş üçün mövcud qalib sayı (random + manual + external birlikdə). */
export async function countWinners(db: Db, giveawayId: string): Promise<number> {
  return db.giveawayWinner.count({ where: { giveawayId } });
}

export class WinnerLimitError extends Error {
  constructor() {
    super("WINNER_LIMIT");
    this.name = "WinnerLimitError";
  }
}

// ─── Snapshot köməkçiləri ─────────────────────────────────────────────────────

type EntrySnapshot = {
  id: string;
  user: { name: string | null; phone: string | null; email: string | null; avatarUrl?: string | null };
};

function normStr(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s : null;
}

// ─── Yaratma (limit transaction daxilində) ────────────────────────────────────

export type CreateWinnerInput = {
  giveawayId: string;
  actorId: string | null;
  // Sayt iştirakçısından: entryId + method (MANUAL/RANDOM). Xaricdən: entryId null.
  entryId?: string | null;
  name?: string;
  phone?: string | null;
  email?: string | null;
  instagramUsername?: string | null;
  avatarUrl?: string | null;
  prizeTitle?: string | null;
  source: string;
  selectionMethod: string;
  selectedAt?: Date;
  proofUrl?: string | null;
  proofIsPublic?: boolean;
  internalNote?: string | null;
  isPublic?: boolean;
};

/**
 * Qalib yaradır — limit yoxlaması TRANSACTION daxilində. Sayt iştirakçısı üçün
 * (entryId dolu) məlumatlar entry snapshot-undan götürülür, entry.isWinner true
 * olur. Xarici qalib üçün (entryId null) sahələr birbaşa daxil edilir.
 *
 * Limiti keçirsə `WinnerLimitError` atır.
 */
export async function createWinner(input: CreateWinnerInput) {
  return prisma.$transaction(async (tx) => {
    const giveaway = await tx.giveaway.findUnique({
      where: { id: input.giveawayId },
      select: { id: true, winnersCount: true, status: true, drawnAt: true, prizeLabel: true },
    });
    if (!giveaway) throw new Error("GIVEAWAY_NOT_FOUND");

    const current = await tx.giveawayWinner.count({ where: { giveawayId: input.giveawayId } });
    if (!withinWinnerLimit(current, 1, giveaway.winnersCount)) {
      throw new WinnerLimitError();
    }

    let data: {
      giveawayId: string;
      entryId: string | null;
      name: string;
      phone: string | null;
      email: string | null;
      instagramUsername: string | null;
      avatarUrl: string | null;
      prizeTitle: string | null;
      source: string;
      selectionMethod: string;
      selectedAt: Date;
      selectedById: string | null;
      proofUrl: string | null;
      proofIsPublic: boolean;
      internalNote: string | null;
      isPublic: boolean;
    };

    if (input.entryId) {
      const entry = (await tx.giveawayEntry.findUnique({
        where: { id: input.entryId },
        select: {
          id: true,
          giveawayId: true,
          user: { select: { name: true, phone: true, email: true, avatarUrl: true } },
        },
      })) as (EntrySnapshot & { giveawayId: string }) | null;
      if (!entry || entry.giveawayId !== input.giveawayId) throw new Error("ENTRY_MISMATCH");

      // Eyni entry üçün ikiqat qalib qeydinin qarşısını al.
      const dupe = await tx.giveawayWinner.findFirst({
        where: { giveawayId: input.giveawayId, entryId: input.entryId },
        select: { id: true },
      });
      if (dupe) throw new Error("ENTRY_ALREADY_WINNER");

      data = {
        giveawayId: input.giveawayId,
        entryId: entry.id,
        name: entry.user.name || "İştirakçı",
        phone: entry.user.phone ?? null,
        email: entry.user.email ?? null,
        instagramUsername: null,
        avatarUrl: entry.user.avatarUrl ?? null,
        prizeTitle: normStr(input.prizeTitle) ?? giveaway.prizeLabel,
        source: "WEBSITE_ENTRY",
        selectionMethod: input.selectionMethod === "RANDOM" ? "RANDOM" : "MANUAL",
        selectedAt: input.selectedAt ?? new Date(),
        selectedById: input.actorId,
        proofUrl: normStr(input.proofUrl),
        proofIsPublic: Boolean(input.proofIsPublic),
        internalNote: normStr(input.internalNote),
        isPublic: input.isPublic ?? true,
      };

      await tx.giveawayEntry.update({ where: { id: entry.id }, data: { isWinner: true } });
    } else {
      const name = normStr(input.name);
      if (!name) throw new Error("NAME_REQUIRED");
      data = {
        giveawayId: input.giveawayId,
        entryId: null,
        name,
        phone: normStr(input.phone),
        email: normStr(input.email),
        instagramUsername: normStr(input.instagramUsername),
        avatarUrl: normStr(input.avatarUrl),
        prizeTitle: normStr(input.prizeTitle) ?? giveaway.prizeLabel,
        source: isWinnerSource(input.source) ? input.source : "MANUAL_OTHER",
        selectionMethod: "EXTERNAL",
        selectedAt: input.selectedAt ?? new Date(),
        selectedById: input.actorId,
        proofUrl: normStr(input.proofUrl),
        proofIsPublic: Boolean(input.proofIsPublic),
        internalNote: normStr(input.internalNote),
        isPublic: input.isPublic ?? true,
      };
    }

    const winner = await tx.giveawayWinner.create({ data });

    // İlk qalib əlavə olunanda çəkilişi tamamla (ictimai göstərim üçün).
    if (giveaway.status !== "COMPLETED") {
      await tx.giveaway.update({
        where: { id: giveaway.id },
        data: { status: "COMPLETED", drawnAt: giveaway.drawnAt ?? new Date() },
      });
    }

    return winner;
  });
}

// ─── Entry körpüsü (random draw / manual toggle üçün) ─────────────────────────

/**
 * Random çəkilişdən seçilən entry-lər üçün GiveawayWinner (RANDOM) qeydləri
 * yaradır. `drawGiveawayWinners` transaction-u daxilində çağırılır. Mövcud
 * entry-əsaslı qaliblər əvvəlcədən silinməlidir (yenidən çəkmə).
 */
export async function createRandomWinnerRows(
  tx: Db,
  giveawayId: string,
  entries: { id: string; user: { name: string | null; phone: string | null; email: string | null; avatarUrl: string | null } }[],
  prizeLabel: string,
  actorId: string | null
): Promise<void> {
  for (const e of entries) {
    await tx.giveawayWinner.create({
      data: {
        giveawayId,
        entryId: e.id,
        name: e.user.name || "İştirakçı",
        phone: e.user.phone ?? null,
        email: e.user.email ?? null,
        instagramUsername: null,
        avatarUrl: e.user.avatarUrl ?? null,
        prizeTitle: prizeLabel,
        source: "WEBSITE_ENTRY",
        selectionMethod: "RANDOM",
        selectedAt: new Date(),
        selectedById: actorId,
        isPublic: true,
      },
    });
  }
}
