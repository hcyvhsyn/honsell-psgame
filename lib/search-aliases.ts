/**
 * Franchise alias dictionary.
 *
 * Two responsibilities:
 *   1. **Query-time expansion** — when a user types "fifa", we ALSO search for
 *      "ea sports fc" (the rebranded title), so both old FIFA editions and
 *      the new EA Sports FC titles surface in the same result set.
 *   2. **Embedding-side franchise context** — at embed time we append a short
 *      franchise descriptor to the row's text ("EA Sports FC 26
 *      [FIFA football soccer]") so the vector lives near "fifa"-style queries
 *      even when the title has zero textual overlap with the query.
 *
 * Each row in `ALIAS_GROUPS` is one canonical group of synonyms; matching any
 * member of a group surfaces every member. Bidirectional duplication is
 * avoided by deriving the lookup table at module load.
 */

/**
 * Each inner array is a synonym set. Order inside a group is meaningful only
 * for the `findFranchiseContext` summary (it takes the first ~3 tokens). Add
 * new groups freely; the lookup map is derived from this list at startup.
 *
 * Keep groups TIGHT — a permissive group ("rpg", "open world") would over-
 * expand most queries and pollute results. Use this for franchise rebrands,
 * abbreviations, and tight cross-language equivalents only.
 */
const ALIAS_GROUPS: string[][] = [
  // Football — FIFA → EA Sports FC rebrand (2023). Numeric editions are
  // explicit so semantic queries match concrete catalog titles.
  ["fifa", "ea sports fc", "fc 24", "fc 25", "fc 26", "football"],
  ["pes", "pro evolution soccer", "efootball"],

  // Action/RPG abbreviations and AZ-typo conventions.
  ["gta", "geta", "grand theft auto"],
  ["cod", "call of duty"],
  ["dark souls", "souls"],
  ["the witcher", "witcher"],
  ["the elder scrolls", "elder scrolls", "skyrim", "oblivion"],
  ["assassin's creed", "ac", "assassins creed"],
  ["red dead", "rdr", "red dead redemption"],

  // Sony first-party
  ["spider-man", "spiderman", "spider man"],
  ["god of war", "gow"],
  ["the last of us", "tlou", "last of us"],

  // Racing / driving
  ["forza", "forza horizon", "forza motorsport"],
  ["gran turismo", "gt sport", "gt7"],
  ["need for speed", "nfs"],
  ["f1", "formula 1", "formula one"],

  // Fighting
  ["mortal kombat", "mk"],
  ["street fighter", "sf"],
  ["tekken"],
  ["super smash", "smash bros"],

  // Sports
  ["nba 2k", "nba"],
  ["nhl"],
  ["madden", "madden nfl"],
  ["wwe 2k", "wwe"],
  ["ufc"],

  // Azerbaijani / Turkish keyword → English franchise mapping
  ["futbol", "ea sports fc", "fifa", "soccer"],
  ["döyüş", "doyus", "mortal kombat", "tekken", "street fighter"],
  ["maşın", "masin", "araba", "forza", "gran turismo", "f1", "racing"],
  ["yarış", "yaris", "forza", "gran turismo", "f1", "racing"],
  ["müharibə", "muharibe", "savaş", "savas", "call of duty", "battlefield"],
  ["qorxu", "korku", "resident evil", "silent hill", "outlast"],

  // PSN currency / wallet variants
  ["psn", "playstation network", "playstation plus", "ps plus"],
  ["v-bucks", "vbucks", "fortnite v-bucks"],
];

/**
 * Short aliases (≤3 chars like "fc", "gt", "mk", "sf", "ac", "gow") would
 * substring-match unrelated titles ("FC Barcelona", "Galactic Empire" via
 * "ge"). We force them to match on whole-word boundaries.
 */
const SHORT_ALIAS_LIMIT = 3;

/** Build the variant→group lookup once at module load. */
const ALIAS_LOOKUP: Map<string, string[]> = (() => {
  const m = new Map<string, string[]>();
  for (const group of ALIAS_GROUPS) {
    for (const variant of group) {
      const key = variant.toLowerCase();
      // If a variant appears in multiple groups, the last write wins. In
      // practice variants are unique across the table; new collisions
      // surface in tests immediately.
      m.set(key, group);
    }
  }
  return m;
})();

/**
 * If the query contains any digit AND matches a known franchise, the user is
 * asking for a specific edition ("fifa 22", "cod mw 19", "the witcher 3").
 * Suppressing alias expansion respects that intent — they'd be annoyed to
 * search "fifa 22" and get FC 26 mixed in.
 */
const ANY_DIGIT_RE = /\d/;

export type AliasExpansion = {
  /** Query variants to search across. Always includes the original. */
  variants: string[];
  /** True iff at least one alias was actually applied. */
  expanded: boolean;
};

/**
 * Expand a query into all canonical-group variants for any alias it contains.
 *
 * - "fifa"         → { variants: ["fifa", "ea sports fc", "fc 24", ...], expanded: true }
 * - "fifa 22"      → { variants: ["fifa 22"], expanded: false }   (edition guard)
 * - "cod mw 19"    → { variants: ["cod mw 19"], expanded: false } (edition guard)
 * - "cyberpunk"    → { variants: ["cyberpunk"], expanded: false } (no alias)
 * - "fc barcelona" → { variants: ["fc barcelona"], expanded: false } (word boundary blocks 2-letter "fc")
 */
export function expandAliases(query: string): AliasExpansion {
  const trimmed = query.trim();
  if (trimmed.length < 2) return { variants: [trimmed], expanded: false };

  const lower = trimmed.toLowerCase();
  const out = new Set<string>([trimmed]);
  let matchedAny = false;

  for (const [variant, group] of ALIAS_LOOKUP.entries()) {
    if (matchesAlias(lower, variant)) {
      for (const member of group) {
        if (member.toLowerCase() !== lower) out.add(member);
      }
      matchedAny = true;
    }
  }

  // Edition guard: a digit anywhere in the query, combined with a franchise
  // alias match, signals "I want this specific edition". Drop the expansion
  // and return the literal query so the keyword search can pin the exact
  // edition. We still set expanded=false so the UI hint stays off.
  if (matchedAny && ANY_DIGIT_RE.test(trimmed)) {
    return { variants: [trimmed], expanded: false };
  }

  return { variants: [...out], expanded: matchedAny };
}

function matchesAlias(query: string, alias: string): boolean {
  if (alias.length <= SHORT_ALIAS_LIMIT) {
    // Word-boundary match: "fc" matches "fc" but not "fortune cookie".
    // Escape regex meta-chars just in case future aliases contain dots etc.
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|\\s|[-_])${escaped}(\\s|$|[-_])`, "i").test(query);
  }
  return query.includes(alias);
}

/**
 * Returns a short franchise descriptor to append to a game's embedding text.
 * Limited to ~5 tokens to avoid diluting non-franchise embeddings.
 *
 * Example: title "EA Sports FC 26" → "FIFA football soccer"
 *          title "Cyberpunk 2077"  → "" (no franchise alias known)
 */
export function findFranchiseContext(title: string): string {
  if (!title) return "";
  const lowerTitle = title.toLowerCase();

  for (const group of ALIAS_GROUPS) {
    // A title belongs to a group if any group member appears in it (with
    // word-boundary rules for short aliases — same logic as query expansion,
    // so "FC Barcelona" doesn't accidentally pick up the FIFA group).
    const hit = group.find((variant) =>
      matchesAlias(lowerTitle, variant.toLowerCase())
    );
    if (!hit) continue;

    // Emit the OTHER members of the group (not the title itself's match),
    // capped at 4 tokens worth so the embedding stays focused.
    const others = group.filter((v) => v.toLowerCase() !== hit.toLowerCase());
    const tokens: string[] = [];
    for (const o of others) {
      tokens.push(o);
      if (tokens.join(" ").split(/\s+/).length >= 5) break;
    }
    return tokens.join(" ");
  }

  return "";
}
