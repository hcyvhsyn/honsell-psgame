/**
 * SEO-friendly slug generation for game detail URLs.
 *
 * Before this, game pages lived at `/oyunlar/EP9000-PPSA01325_00-GODOFWAR000000`
 * — a URL with zero keyword signal. Now they live at
 * `/oyunlar/god-of-war-ragnarok-ps5`, with the raw productId kept as a
 * permanent 301 source so every old link, email and campaign URL keeps working.
 *
 * Slugs are stored on `Game.slug` (unique) and generated once; a title change
 * during a re-scrape does NOT rotate an existing slug (that would break links
 * and lose accumulated ranking). Only rows with a NULL slug get one assigned.
 */

/**
 * Transliterates the accented characters that actually show up in PS Store
 * titles localised for the TR storefront, plus the Azerbaijani `ə`. Anything
 * outside this map is dropped by the alphanumeric filter below.
 */
const CHAR_MAP: Record<string, string> = {
  ı: "i", İ: "i", ş: "s", Ş: "s", ğ: "g", Ğ: "g",
  ü: "u", Ü: "u", ö: "o", Ö: "o", ç: "c", Ç: "c",
  ə: "e", Ə: "e", â: "a", Â: "a", î: "i", Î: "i", û: "u", Û: "u",
  á: "a", à: "a", ä: "a", å: "a", ã: "a",
  é: "e", è: "e", ê: "e", ë: "e",
  í: "i", ì: "i", ï: "i",
  ó: "o", ò: "o", ô: "o", õ: "o", ø: "o",
  ú: "u", ù: "u",
  ñ: "n", ý: "y", ÿ: "y", ß: "ss", æ: "ae",
};

/** Longest slug we will ever emit, before the platform suffix is appended. */
const MAX_BASE_LEN = 70;

function transliterate(input: string): string {
  let out = "";
  for (const ch of input) out += CHAR_MAP[ch] ?? ch;
  return out;
}

/**
 * Turns arbitrary text into a URL-safe kebab-case token.
 * Returns "" when nothing usable survives (e.g. a title that is entirely CJK).
 */
export function slugifyText(input: string): string {
  return transliterate(input)
    // Trademark/copyright marks glue words together if simply removed, so they
    // become separators: "EA SPORTS FC™ 26" → "ea-sports-fc-26".
    .replace(/[™®©℠]/g, " ")
    // Apostrophes are dropped, not turned into a separator: "Marvel's" should
    // slug as "marvels", never "marvel-s".
    .replace(/['’‘`]/g, "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip any remaining combining accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Normalises `Game.platform` ("PS5", "PS4", "PS5,PS4") into a URL suffix.
 * Cross-gen SKUs get `ps4-ps5` so they never collide with the single-platform
 * editions of the same title, which are separate products with separate prices.
 */
export function platformSuffix(platform: string | null | undefined): string {
  if (!platform) return "";
  const parts = platform
    .split(",")
    .map((p) => p.trim().toUpperCase())
    .filter((p) => p === "PS4" || p === "PS5" || p === "PC");
  if (parts.length === 0) return "";
  // Stable ascending order regardless of how the scraper happened to store it.
  const ordered = (["PS4", "PS5", "PC"] as const).filter((p) => parts.includes(p));
  return ordered.map((p) => p.toLowerCase()).join("-");
}

/**
 * Short deterministic suffix derived from the productId. Used only to break a
 * collision — two genuinely different SKUs whose titles slugify identically
 * (common with regional re-releases and "…  PS4 & PS5" bundles).
 */
export function slugDisambiguator(productId: string): string {
  let h = 5381;
  for (let i = 0; i < productId.length; i++) {
    h = ((h << 5) + h + productId.charCodeAt(i)) >>> 0;
  }
  return h.toString(36).slice(0, 5);
}

function truncateOnWordBoundary(slug: string, max: number): string {
  if (slug.length <= max) return slug;
  const cut = slug.slice(0, max);
  const lastDash = cut.lastIndexOf("-");
  // Only fall back to a hard cut when the first word alone exceeds the budget.
  return (lastDash > max * 0.5 ? cut.slice(0, lastDash) : cut).replace(/-+$/, "");
}

/**
 * Builds the candidate slug for a game. Does NOT guarantee uniqueness — callers
 * must resolve collisions via `buildUniqueGameSlug`.
 */
export function buildGameSlug(game: {
  title: string;
  platform?: string | null;
  productId: string;
}): string {
  const base = truncateOnWordBoundary(slugifyText(game.title), MAX_BASE_LEN);
  const suffix = platformSuffix(game.platform);

  if (!base) {
    // Titles with no latin characters at all still need a routable slug.
    return `oyun-${slugDisambiguator(game.productId)}`;
  }
  if (!suffix) return base;

  // Many PS Store titles already name their platforms ("… PS4 ve PS5",
  // "… PS5"). Appending the suffix blindly produces "…-ps4-ve-ps5-ps4-ps5", so
  // skip it when every platform token is already present in the tail of the
  // slug. The tail window is deliberately small — "PS4" appearing in the middle
  // of a long title is not the same as the title being platform-labelled.
  const suffixTokens = suffix.split("-");
  const tail = base.split("-").slice(-(suffixTokens.length * 2 + 1));
  if (suffixTokens.every((t) => tail.includes(t))) return base;

  return `${base}-${suffix}`;
}

/**
 * Resolves `buildGameSlug` against a set of slugs already taken. `isTaken` lets
 * the caller check the DB (backfill) or an in-memory Set (batch import).
 */
export async function buildUniqueGameSlug(
  game: { title: string; platform?: string | null; productId: string },
  isTaken: (slug: string) => boolean | Promise<boolean>
): Promise<string> {
  const candidate = buildGameSlug(game);
  if (!(await isTaken(candidate))) return candidate;

  // First fallback is deterministic, so re-running the backfill is idempotent:
  // the same product always lands on the same slug.
  const withHash = `${candidate}-${slugDisambiguator(game.productId)}`;
  if (!(await isTaken(withHash))) return withHash;

  // Pathological case only (hash collision on top of a title collision).
  for (let i = 2; i < 100; i++) {
    const numbered = `${withHash}-${i}`;
    if (!(await isTaken(numbered))) return numbered;
  }
  throw new Error(`Slug təyin edilə bilmədi: ${game.productId}`);
}

/**
 * Canonical detail-page href for a game.
 *
 * Prefers the slug and falls back to the productId, so a row the backfill has
 * not reached yet still links somewhere valid (the route 308s it later). Kept
 * in this dependency-free module on purpose — client components import it, and
 * anything that transitively reaches `lib/prisma` breaks `next build`.
 */
export function gameDetailHref(game: {
  slug?: string | null;
  productId?: string | null;
}): string | null {
  if (game.slug) return `/oyunlar/${game.slug}`;
  if (game.productId) return `/oyunlar/${encodeURIComponent(game.productId)}`;
  return null;
}

/**
 * A PS Store productId always contains a `CUSA`/`PPSA` title code and dashes;
 * a slug never does. Used by the detail route to decide whether the incoming
 * path segment is a legacy productId that must be 301'd to its slug.
 */
export function looksLikeProductId(segment: string): boolean {
  return /^(EP|UP|JP|HP)\d{4}-/i.test(segment) || /^epic:/i.test(segment);
}
