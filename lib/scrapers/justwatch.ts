import { SCRAPER_CONFIG, type Platform } from "@/lib/scrapers/config";
import { fetchWithRetry } from "@/lib/scrapers/fetchWithRetry";
import { normalizeLanguageList } from "@/lib/scrapers/languageNormalize";
import type { ScrapedTitle, ScraperResult } from "@/lib/scrapers/types";

/**
 * JustWatch gizli GraphQL API — `apis.justwatch.com/graphql`.
 *
 * Auth/key tələb etmir, lakin rate-limit-i aqressivdir; 200ms pacing kifayət edir.
 * Sorğu strukturu son public reverse-engineering-ə əsaslanır — JustWatch təxminən
 * ildə bir field rename edir, ona görə cavab parse-ı defensiv yazılıb (?.). Əgər
 * cavab forması dəyişərsə `mapNode` funksiyasını yenilə.
 *
 * Provider shortNames (AZ kataloqunda olan):
 *   - HBO Max:           "max"  (köhnə adı "hbm")
 *   - Amazon Prime Video: "amp"
 *
 * Bir başlıqdakı dil informasiyası `offers` siyahısında gəlir — hər offer
 * (subscription/rent/buy) öz `audioLanguages` və `subtitleLanguages` siyahısını
 * verir. Bizə yalnız `MONETIZATION_TYPE: FLATRATE` (abunəlik) maraqlıdır.
 */

const JW_ENDPOINT = "https://apis.justwatch.com/graphql";

const POPULAR_TITLES_QUERY = `
query GetPopularTitles(
  $country: Country!
  $packages: [String!]!
  $first: Int!
  $after: String
) {
  popularTitles(
    country: $country
    first: $first
    after: $after
    filter: { packages: $packages, objectTypes: [MOVIE, SHOW] }
  ) {
    totalCount
    pageInfo { hasNextPage endCursor }
    edges {
      cursor
      node {
        id
        objectType
        objectId
        content(country: $country, language: "en") {
          title
          originalReleaseYear
          shortDescription
          fullPath
          genres { translation(language: "en") }
          externalIds { imdbId }
          posterUrl
        }
        offers(country: $country, platform: WEB) {
          monetizationType
          package { shortName clearName }
          audioLanguages
          subtitleLanguages
          standardWebURL
          deeplinkURL: standardWebURL
        }
      }
    }
  }
}`;

interface JwOffer {
  monetizationType?: string;
  package?: { shortName?: string; clearName?: string };
  audioLanguages?: string[];
  subtitleLanguages?: string[];
  standardWebURL?: string;
}

interface JwNode {
  id?: string;
  objectType?: string;
  objectId?: number | string;
  content?: {
    title?: string;
    originalReleaseYear?: number;
    shortDescription?: string;
    fullPath?: string;
    genres?: Array<{ translation?: string }>;
    externalIds?: { imdbId?: string };
    posterUrl?: string;
  };
  offers?: JwOffer[];
}

interface JwResponse {
  data?: {
    popularTitles?: {
      totalCount?: number;
      pageInfo?: { hasNextPage?: boolean; endCursor?: string };
      edges?: Array<{ cursor: string; node: JwNode }>;
    };
  };
  errors?: Array<{ message: string }>;
}

function mapNode(node: JwNode, providerShortName: string): ScrapedTitle | null {
  if (!node.id || !node.content?.title) return null;
  const flatrateOffers = (node.offers ?? []).filter(
    (o) =>
      (o.monetizationType ?? "").toUpperCase() === "FLATRATE" &&
      o.package?.shortName === providerShortName
  );
  if (flatrateOffers.length === 0) return null;

  const audio = normalizeLanguageList(flatrateOffers.flatMap((o) => o.audioLanguages ?? []));
  const subtitle = normalizeLanguageList(
    flatrateOffers.flatMap((o) => o.subtitleLanguages ?? [])
  );
  const deepLink = flatrateOffers[0]?.standardWebURL;
  const kind: "MOVIE" | "SERIES" =
    (node.objectType ?? "").toUpperCase() === "SHOW" ? "SERIES" : "MOVIE";

  return {
    platformExternalId: node.id,
    deepLinkUrl: deepLink ?? undefined,
    title: node.content.title,
    kind,
    year: node.content.originalReleaseYear,
    genres: (node.content.genres ?? [])
      .map((g) => g.translation)
      .filter((g): g is string => !!g),
    imdbId: node.content.externalIds?.imdbId,
    posterUrl: node.content.posterUrl
      ? `https://images.justwatch.com${node.content.posterUrl.replace("{profile}", "s592")}`
      : undefined,
    description: node.content.shortDescription,
    audioLanguages: audio,
    subtitleLanguages: subtitle,
  };
}

const PACKAGES_QUERY = `
query GetPackages($country: Country!) {
  packages(country: $country, platform: WEB) {
    clearName
    shortName
  }
}`;

interface JwPackagesResponse {
  data?: { packages?: Array<{ clearName?: string; shortName?: string }> };
  errors?: Array<{ message: string }>;
}

/**
 * Verilmiş ölkədə bir provider-in (clearName üzrə, məs. "Amazon Prime Video")
 * JustWatch package shortName-ini tapır. ShortName-lər region-spesifikdir:
 * DE/GB-də Prime "amp", FR-də "prv". Tapılmazsa `fallback` qaytarılır.
 */
export async function resolvePackageShortName(
  country: string,
  clearName: string,
  fallback: string
): Promise<string> {
  try {
    const res = await fetchWithRetry(JW_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "user-agent": "Mozilla/5.0 (compatible; honsell-streaming-sync/1.0; +https://honsell.store)",
      },
      body: JSON.stringify({ query: PACKAGES_QUERY, variables: { country } }),
      pacingMs: SCRAPER_CONFIG.rateLimitMs.PRIME,
    });
    const data = (await res.json()) as JwPackagesResponse;
    const target = clearName.trim().toLowerCase();
    const match = (data.data?.packages ?? []).find(
      (p) => (p.clearName ?? "").trim().toLowerCase() === target
    );
    return match?.shortName ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * Bir JustWatch provider üçün verilmiş ölkənin kataloqunu çəkir. Pagination
 * cursor ilə — `hasNextPage=false` olana və ya `maxPages` limitinə çatana qədər.
 *
 * @param country  ISO 3166-1 alpha-2 ölkə kodu. Default `SCRAPER_CONFIG.country`
 *                 (AZ) — HBO Max kimi tək-region platformalar üçün.
 * @param maxPages Səhifə tavanı. Default `SCRAPER_CONFIG.maxPagesPerPlatform`;
 *                 Prime tam katalog üçün `primeMaxPages` ötürür.
 */
export async function scrapeJustWatchProvider(
  platform: Platform,
  providerShortName: string,
  country: string = SCRAPER_CONFIG.country,
  maxPages: number = SCRAPER_CONFIG.maxPagesPerPlatform
): Promise<ScraperResult> {
  const startedAt = Date.now();
  const warnings: string[] = [];
  const titlesById = new Map<string, ScrapedTitle>();
  let requestCount = 0;
  let cursor: string | undefined = undefined;
  const pageSize = 40;

  for (let page = 1; page <= maxPages; page++) {
    try {
      const res = await fetchWithRetry(JW_ENDPOINT, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "accept": "application/json",
          "user-agent":
            "Mozilla/5.0 (compatible; honsell-streaming-sync/1.0; +https://honsell.store)",
        },
        body: JSON.stringify({
          query: POPULAR_TITLES_QUERY,
          variables: {
            country,
            packages: [providerShortName],
            first: pageSize,
            after: cursor,
          },
        }),
        pacingMs: SCRAPER_CONFIG.rateLimitMs[platform],
      });
      requestCount++;
      const data = (await res.json()) as JwResponse;

      if (data.errors?.length) {
        warnings.push(
          `JustWatch GraphQL errors (page ${page}): ${data.errors.map((e) => e.message).join("; ")}`
        );
      }

      const edges = data.data?.popularTitles?.edges ?? [];
      for (const edge of edges) {
        const mapped = mapNode(edge.node, providerShortName);
        if (mapped && !titlesById.has(mapped.platformExternalId)) {
          titlesById.set(mapped.platformExternalId, mapped);
        }
      }

      const pageInfo = data.data?.popularTitles?.pageInfo;
      if (!pageInfo?.hasNextPage || !pageInfo.endCursor) break;
      cursor = pageInfo.endCursor;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (titlesById.size === 0) {
        return {
          platform,
          country,
          titles: [],
          warnings,
          fatalError: `JustWatch (${providerShortName}, ${country}) əlçatan deyil: ${msg}`,
          stats: { requestCount, durationMs: Date.now() - startedAt },
        };
      }
      warnings.push(`JustWatch page ${page} failed: ${msg}`);
      break;
    }
  }

  return {
    platform,
    country,
    titles: [...titlesById.values()],
    warnings,
    stats: { requestCount, durationMs: Date.now() - startedAt },
  };
}
