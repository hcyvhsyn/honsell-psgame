import { prisma } from "@/lib/prisma";

export type LeaderboardEntry = {
  userId: string;
  displayName: string; // "Ə*** A***" formatında — anonimləşdirilmiş
  avatarLetter: string;
  earnedAzn: number;
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

/**
 * Cari ay üçün top X referer — COMMISSION + REFERRAL_TIER_BONUS-un cəmi.
 * Anonimləşdirilmiş ad qaytarır (ad varsa "Ə*** A***" formatında, yoxsa email-in əvvəli).
 */
export async function getReferralLeaderboard(limit: number = 10): Promise<LeaderboardEntry[]> {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);

  const rows = await prisma.transaction.groupBy({
    by: ["beneficiaryId"],
    where: {
      type: { in: ["COMMISSION", "REFERRAL_TIER_BONUS"] },
      createdAt: { gte: start },
      beneficiaryId: { not: null },
    },
    _sum: { amountAznCents: true },
    orderBy: { _sum: { amountAznCents: "desc" } },
    take: limit,
  });

  const ids = rows.map((r) => r.beneficiaryId).filter((x): x is string => !!x);
  if (ids.length === 0) return [];

  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, email: true },
  });
  const userById = new Map(users.map((u) => [u.id, u]));

  return rows.map((r, i) => {
    const u = userById.get(r.beneficiaryId!);
    const displayName = u ? obscure(u.name, u.email) : "Anonim";
    const avatarLetter = (u?.name ?? u?.email ?? "?")[0]?.toUpperCase() ?? "?";
    const earned = (r._sum.amountAznCents ?? 0) / 100;
    return {
      userId: r.beneficiaryId!,
      displayName,
      avatarLetter,
      earnedAzn: earned,
      rank: i + 1,
    };
  });
}
