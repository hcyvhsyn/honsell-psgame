import { prisma } from "@/lib/prisma";
import { getCurrentCycle, getLastClosedCycle } from "@/lib/referralCycle";

export type LeaderboardEntry = {
  userId: string;
  displayName: string; // "Ə*** A***" formatında — anonimləşdirilmiş
  avatarLetter: string;
  /** Aylıq cycle-da yığılan total bal (10 × dəvət + AZN xərc). */
  points: number;
  invites: number;
  spendAzn: number;
  rank: number;
};

function obscure(name: string | null, email: string): string {
  const src = (name?.trim() || email.split("@")[0] || "?").trim();
  const parts = src.split(/\s+/).filter(Boolean);
  const masked = (s: string) => {
    if (s.length === 0) return "";
    if (s.length === 1) return `${s[0].toUpperCase()}***`;
    return `${s[0].toUpperCase()}${s[1]}***`;
  };
  if (parts.length >= 2) return `${masked(parts[0])} ${masked(parts[1])}`;
  return masked(parts[0] ?? "?");
}

async function buildEntries(
  rows: Array<{
    userId: string;
    points: number;
    invites: number;
    spendCents: number;
    rank: number | null;
  }>,
  fallbackRank: boolean
): Promise<LeaderboardEntry[]> {
  const ids = rows.map((r) => r.userId);
  if (ids.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, email: true },
  });
  const userById = new Map(users.map((u) => [u.id, u]));
  return rows.map((r, i) => {
    const u = userById.get(r.userId);
    const displayName = u ? obscure(u.name, u.email) : "Anonim";
    const avatarLetter = (u?.name ?? u?.email ?? "?")[0]?.toUpperCase() ?? "?";
    return {
      userId: r.userId,
      displayName,
      avatarLetter,
      points: r.points,
      invites: r.invites,
      spendAzn: r.spendCents / 100,
      rank: r.rank ?? (fallbackRank ? i + 1 : i + 1),
    };
  });
}

/**
 * Cari ay (active cycle) üçün top X referer — `points` üzrə sıralama.
 * Cycle hələ bağlanmadığına görə rank dinamik (sırada gəliş) olaraq verilir.
 */
export async function getReferralLeaderboard(limit: number = 10): Promise<LeaderboardEntry[]> {
  const cycle = await getCurrentCycle();
  const rows = await prisma.referralCycleResult.findMany({
    where: { cycleId: cycle.id, points: { gt: 0 } },
    orderBy: [
      { points: "desc" },
      { invites: "desc" },
      { spendCents: "desc" },
    ],
    take: limit,
    select: {
      userId: true,
      points: true,
      invites: true,
      spendCents: true,
      rank: true,
    },
  });
  return buildEntries(rows, true);
}

/**
 * Sonuncu bağlanmış cycle üçün top X — "Keçən ay" arxivi.
 * Bağlandıqda `closeExpiredCycles()` hər result-a `rank` yazır, ona görə
 * sırala bunu istifadə edirik.
 */
export async function getLastCycleLeaderboard(limit: number = 10): Promise<{
  cycle: { startsAt: Date; endsAt: Date } | null;
  entries: LeaderboardEntry[];
}> {
  const cycle = await getLastClosedCycle();
  if (!cycle) return { cycle: null, entries: [] };
  const rows = await prisma.referralCycleResult.findMany({
    where: { cycleId: cycle.id, points: { gt: 0 } },
    orderBy: [{ rank: "asc" }, { points: "desc" }],
    take: limit,
    select: {
      userId: true,
      points: true,
      invites: true,
      spendCents: true,
      rank: true,
    },
  });
  const entries = await buildEntries(rows, false);
  return {
    cycle: { startsAt: cycle.startsAt, endsAt: cycle.endsAt },
    entries,
  };
}
