/**
 * Oyunlar üçün mənfəət qaydası — client-safe, SAF (prisma import etmir; settings
 * səhifəsinin önizləməsi də bunu işlədir).
 *
 * Pillələr mayaya (TRY × məzənnə, mənfəətdən ƏVVƏL) görə seçilir:
 *   [{ upToAzn: 20, pct: 50 }, { upToAzn: 100, pct: 20 }, { upToAzn: null, pct: 10 }]
 *
 * DÖŞƏMƏ QAYDASI: sadə pillədə sərhəddə qiymət düşür (maya 19.99 → 29.99 ₼, maya
 * 20.01 → 24.01 ₼ — bahalı oyun ucuzdan ucuz satılır). Ona görə qiymət heç vaxt
 * əvvəlki pillənin tavanından (upTo × (1 + pct)) aşağı düşmür: maya 20.01 → 30 ₼.
 * Nəticə funksiya MONOTONDUR — `aznToTryCents` tərsi və TRY ilə sıralama buna güvənir.
 *
 * Prioritet (`resolveGamePriceAzn`): sabit AZN qiyməti > oyunun öz faizi > pillələr.
 */

export type GameMarginTier = {
  /** Maya bu məbləğə qədər (daxil) olduqda. `null` = son pillə (sonsuz). */
  upToAzn: number | null;
  pct: number;
};

export type GameCustomPricing = {
  customMarginPct: number | null;
  customPriceAznCents: number | null;
};

export const MAX_GAME_MARGIN_PCT = 500;

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

/** Mayadan satış qiyməti (AZN). Pillə yoxdursa köhnə tək faiz. */
export function tieredGameAzn(
  costAzn: number,
  tiers: GameMarginTier[],
  fallbackPct: number,
): number {
  if (tiers.length === 0) return round2(costAzn * (1 + fallbackPct / 100));
  let floor = 0;
  for (const tier of tiers) {
    if (tier.upToAzn == null || costAzn <= tier.upToAzn) {
      return round2(Math.max(costAzn * (1 + tier.pct / 100), floor));
    }
    floor = Math.max(floor, tier.upToAzn * (1 + tier.pct / 100));
  }
  // normalize son pilləni həmişə `null` edir; bura yalnız əl ilə qurulmuş massivdə çatır.
  const last = tiers[tiers.length - 1];
  return round2(Math.max(costAzn * (1 + last.pct / 100), floor));
}

/** Bu mayaya hansı pillə faizi düşür (admin nişanı üçün). */
export function gameTierPct(
  costAzn: number,
  tiers: GameMarginTier[],
  fallbackPct: number,
): number {
  if (tiers.length === 0) return fallbackPct;
  const tier = tiers.find((t) => t.upToAzn == null || costAzn <= t.upToAzn);
  return (tier ?? tiers[tiers.length - 1]).pct;
}

export function resolveGamePriceAzn(
  costAzn: number,
  game: GameCustomPricing,
  tiers: GameMarginTier[],
  fallbackPct: number,
): number {
  if (game.customPriceAznCents != null && game.customPriceAznCents > 0) {
    return round2(game.customPriceAznCents / 100);
  }
  if (game.customMarginPct != null && Number.isFinite(game.customMarginPct)) {
    return round2(costAzn * (1 + game.customMarginPct / 100));
  }
  return tieredGameAzn(costAzn, tiers, fallbackPct);
}

/**
 * DB-dən (Json) və ya admin formundan gələn dəyəri təmizləyir. Səhv sətirlər atılır,
 * sıralanır, eyni sərhəd təkrarlanmır, son pillə `null` olur. Boş → [] (tək faiz).
 */
export function normalizeGameMarginTiers(raw: unknown): GameMarginTier[] {
  if (!Array.isArray(raw)) return [];
  const bounded: GameMarginTier[] = [];
  let open: GameMarginTier | null = null;
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const pct = Number((item as { pct?: unknown }).pct);
    if (!Number.isFinite(pct) || pct < 0 || pct > MAX_GAME_MARGIN_PCT) continue;
    const rawUpTo = (item as { upToAzn?: unknown }).upToAzn;
    if (rawUpTo == null || rawUpTo === "") {
      open = { upToAzn: null, pct };
      continue;
    }
    const upToAzn = Number(rawUpTo);
    if (!Number.isFinite(upToAzn) || upToAzn <= 0) continue;
    bounded.push({ upToAzn: round2(upToAzn), pct });
  }
  bounded.sort((a, b) => a.upToAzn! - b.upToAzn!);
  const tiers = bounded.filter((t, i) => i === 0 || t.upToAzn !== bounded[i - 1].upToAzn);
  if (tiers.length === 0 && !open) return [];
  if (open) tiers.push(open);
  else tiers[tiers.length - 1] = { upToAzn: null, pct: tiers[tiers.length - 1].pct };
  return tiers;
}
