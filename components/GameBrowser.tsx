"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Search,
  Loader2,
  Gamepad2,
  Filter,
  Tag,
  ChevronDown,
  X,
  Package,
  Coins,
  MoreHorizontal,
  Library,
  Sparkles,
  Check,
  SlidersHorizontal,
} from "lucide-react";
import GameCard, { GameCardData } from "./GameCard";
import { genreLabelAz } from "@/lib/gameCardShared";
import PlatformInfoButton from "./PlatformInfoButton";

/** `/api/games/facets` cavabı — filtr panelinin seçim siyahıları. */
type FacetOption = { value: string; count: number };
type FilterFacets = {
  genres: FacetOption[];
  contentRatings: FacetOption[];
  publishers: FacetOption[];
  releaseYears: { min: number; max: number } | null;
};

type ListingResponse = {
  total: number;
  totalAll: number;
  totalOnSale: number;
  totals: Record<string, number>;
  count: number;
  results: GameCardData[];
  page?: number;
  pageSize?: number;
  totalPages?: number;
};

type Sort =
  | "newest"
  | "popular"
  | "priceAsc"
  | "priceDesc"
  | "discount"
  | "discountAsc"
  | "alpha"
  | "rating"
  | "releaseNew"
  | "releaseOld";
type Platform = "ALL" | "PS4" | "PS5";
type ProductType = "ALL" | "GAME" | "ADDON" | "CURRENCY" | "OTHER";

const DEFAULT_SORT: Sort = "popular";
const DEFAULT_PLATFORM: Platform = "ALL";
const DEFAULT_TYPE: ProductType = "ALL";
const DEFAULT_PAGE_SIZE = 24;

const SORT_OPTIONS: { value: Sort; label: string }[] = [
  { value: "newest", label: "Ən yeni" },
  { value: "popular", label: "Ən populyar" },
  { value: "priceAsc", label: "Qiymət: ucuzdan bahaya" },
  { value: "priceDesc", label: "Qiymət: bahadan ucuza" },
  { value: "discount", label: "Endirim faizi: çoxdan aza" },
  { value: "discountAsc", label: "Endirim faizi: azdan çoxa" },
  // PS Store detal metadata-sına söykənən sıralamalar. Metadata-sı olmayan
  // sətirlər siyahının sonuna düşür, kataloqdan çıxarılmır.
  { value: "rating", label: "Reytinq: yüksəkdən aşağıya" },
  { value: "releaseNew", label: "Çıxış tarixi: yenidən köhnəyə" },
  { value: "releaseOld", label: "Çıxış tarixi: köhnədən yeniyə" },
  { value: "alpha", label: "Əlifba sırası" },
];

/**
 * PS Store istifadəçi reytinqi üçün aşağı hədd seçimləri.
 *
 * Sərbəst rəqəm daxil etməkdənsə hazır pillələr verilir: "4.2+" kimi dəqiqlik
 * heç kimə lazım deyil, istifadəçi "yaxşı olsun" / "çox yaxşı olsun" deyir.
 */
const MIN_RATING_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Fərqi yoxdur" },
  { value: "4.5", label: "4.5+ ulduz" },
  { value: "4", label: "4.0+ ulduz" },
  { value: "3.5", label: "3.5+ ulduz" },
  { value: "3", label: "3.0+ ulduz" },
];

type Accent = "violet" | "indigo" | "fuchsia" | "emerald" | "sky";

const TYPE_TABS: {
  value: ProductType;
  label: string;
  singular: string;
  icon: React.ReactNode;
  accent: Accent;
}[] = [
  { value: "ALL", label: "Hamısı", singular: "Məhsul", icon: <Library className="h-4 w-4" />, accent: "violet" },
  { value: "GAME", label: "Oyunlar", singular: "Oyun", icon: <Gamepad2 className="h-4 w-4" />, accent: "indigo" },
  { value: "ADDON", label: "Əlavələr", singular: "Əlavə", icon: <Package className="h-4 w-4" />, accent: "fuchsia" },
  { value: "CURRENCY", label: "Pul kartları", singular: "Pul kartı", icon: <Coins className="h-4 w-4" />, accent: "emerald" },
  { value: "OTHER", label: "Digər", singular: "Məhsul", icon: <MoreHorizontal className="h-4 w-4" />, accent: "sky" },
];

const ACCENT_STYLES: Record<
  Accent,
  {
    activeWrap: string;
    activeIcon: string;
    activeBadge: string;
    activeText: string;
    glow: string;
    hoverIcon: string;
  }
> = {
  violet: {
    activeWrap: "border-violet-300 bg-violet-50 text-violet-800 shadow-[0_8px_28px_-18px_rgba(124,58,237,0.45)] dark:border-violet-300/[0.45] dark:bg-violet-400/[0.16] dark:text-violet-50 dark:shadow-[0_12px_36px_-18px_rgba(167,139,250,0.7)]",
    activeIcon: "bg-violet-100 text-violet-700 ring-violet-200 dark:bg-violet-300/[0.18] dark:text-violet-50 dark:ring-violet-200/30",
    activeBadge: "bg-violet-100 text-violet-800 dark:bg-violet-200/[0.16] dark:text-violet-50",
    activeText: "text-violet-700 dark:text-violet-50",
    glow: "shadow-[0_8px_28px_-12px_rgba(139,92,246,0.6)] dark:shadow-[0_14px_40px_-22px_rgba(167,139,250,0.9)]",
    hoverIcon: "group-hover:text-violet-600 dark:group-hover:text-violet-300",
  },
  indigo: {
    activeWrap: "border-indigo-300 bg-indigo-50 text-indigo-800 shadow-[0_8px_28px_-18px_rgba(99,102,241,0.45)] dark:border-indigo-300/[0.45] dark:bg-indigo-400/[0.16] dark:text-indigo-50 dark:shadow-[0_12px_36px_-18px_rgba(129,140,248,0.7)]",
    activeIcon: "bg-indigo-100 text-indigo-700 ring-indigo-200 dark:bg-indigo-300/[0.18] dark:text-indigo-50 dark:ring-indigo-200/30",
    activeBadge: "bg-indigo-100 text-indigo-800 dark:bg-indigo-200/[0.16] dark:text-indigo-50",
    activeText: "text-indigo-700 dark:text-indigo-50",
    glow: "shadow-[0_8px_28px_-12px_rgba(99,102,241,0.6)] dark:shadow-[0_14px_40px_-22px_rgba(129,140,248,0.9)]",
    hoverIcon: "group-hover:text-indigo-600 dark:group-hover:text-indigo-300",
  },
  fuchsia: {
    activeWrap: "border-fuchsia-300 bg-fuchsia-50 text-fuchsia-800 shadow-[0_8px_28px_-18px_rgba(217,70,239,0.45)] dark:border-fuchsia-300/[0.45] dark:bg-fuchsia-400/[0.16] dark:text-fuchsia-50 dark:shadow-[0_12px_36px_-18px_rgba(232,121,249,0.7)]",
    activeIcon: "bg-fuchsia-100 text-fuchsia-700 ring-fuchsia-200 dark:bg-fuchsia-300/[0.18] dark:text-fuchsia-50 dark:ring-fuchsia-200/30",
    activeBadge: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-200/[0.16] dark:text-fuchsia-50",
    activeText: "text-fuchsia-700 dark:text-fuchsia-50",
    glow: "shadow-[0_8px_28px_-12px_rgba(217,70,239,0.6)] dark:shadow-[0_14px_40px_-22px_rgba(232,121,249,0.9)]",
    hoverIcon: "group-hover:text-fuchsia-600 dark:group-hover:text-fuchsia-300",
  },
  emerald: {
    activeWrap: "border-emerald-300 bg-emerald-50 text-emerald-800 shadow-[0_8px_28px_-18px_rgba(16,185,129,0.45)] dark:border-emerald-300/[0.45] dark:bg-emerald-400/[0.16] dark:text-emerald-50 dark:shadow-[0_12px_36px_-18px_rgba(52,211,153,0.7)]",
    activeIcon: "bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-300/[0.18] dark:text-emerald-50 dark:ring-emerald-200/30",
    activeBadge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-200/[0.16] dark:text-emerald-50",
    activeText: "text-emerald-700 dark:text-emerald-50",
    glow: "shadow-[0_8px_28px_-12px_rgba(16,185,129,0.6)] dark:shadow-[0_14px_40px_-22px_rgba(52,211,153,0.9)]",
    hoverIcon: "group-hover:text-emerald-600 dark:group-hover:text-emerald-300",
  },
  sky: {
    activeWrap: "border-sky-300 bg-sky-50 text-sky-800 shadow-[0_8px_28px_-18px_rgba(14,165,233,0.45)] dark:border-sky-300/[0.45] dark:bg-sky-400/[0.16] dark:text-sky-50 dark:shadow-[0_12px_36px_-18px_rgba(56,189,248,0.7)]",
    activeIcon: "bg-sky-100 text-sky-700 ring-sky-200 dark:bg-sky-300/[0.18] dark:text-sky-50 dark:ring-sky-200/30",
    activeBadge: "bg-sky-100 text-sky-800 dark:bg-sky-200/[0.16] dark:text-sky-50",
    activeText: "text-sky-700 dark:text-sky-50",
    glow: "shadow-[0_8px_28px_-12px_rgba(14,165,233,0.6)] dark:shadow-[0_14px_40px_-22px_rgba(56,189,248,0.9)]",
    hoverIcon: "group-hover:text-sky-600 dark:group-hover:text-sky-300",
  },
};

// Filter state-i sessionStorage-da saxlayır ki, istifadəçi oyunun daxili
// səhifəsinə keçib geri qayıdanda filterləri itirməsin (komponent unmount/remount
// edilir). URL-i çirkləndirmir, yeni tab açanda təmiz başlayır.
type SavedFilters = {
  productType?: ProductType;
  query?: string;
  sort?: Sort;
  genre?: string;
  platform?: Platform;
  onSale?: boolean;
  priceMin?: string;
  priceMax?: string;
  page?: number;
  contentRating?: string;
  minRating?: string;
  publisher?: string;
  yearMin?: string;
  yearMax?: string;
};

// v2: PS Store metadata filtrləri (janr/PEGI/reytinq/nəşriyyatçı/il) əlavə
// olundu. Versiyanı artırmaq köhnə sessiyalarda qalmış natamam obyektin
// bərpasını kəsir.
const FILTERS_STORAGE_VERSION = "v2";
function filtersStorageKey(store: "PS" | "EPIC") {
  return `honsell.gameBrowser.${store}.${FILTERS_STORAGE_VERSION}`;
}

function readSavedFilters(store: "PS" | "EPIC"): SavedFilters | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(filtersStorageKey(store));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object") return parsed as SavedFilters;
    return null;
  } catch {
    return null;
  }
}

export default function GameBrowser({
  initial,
  store = "PS",
  defaultSort = DEFAULT_SORT,
  categories = [],
  categoryLinks = [],
  lockedFilters,
}: {
  initial: ListingResponse;
  /** Storefront scope. "EPIC" routes requests to the Epic-filtered catalog. */
  store?: "PS" | "EPIC";
  /** Initial sort. Epic has no `isFeatured` rows yet, so it passes "newest". */
  defaultSort?: Sort;
  /** Epic genre/category names for the PC category filter. */
  categories?: string[];
  /**
   * Facet landing səhifələrinə keçidlər (`/ps5-oyunlari`, `/janr/aksiyon`, …).
   *
   * Bunlar filtr DEYİL, ayrı səhifələrdir — SEO üçün belə qurulub. Filtr
   * panelində göstərilir, çünki istifadəçi kateqoriya seçimini burada axtarır,
   * lakin klik naviqasiya edir və cari filtrlər sıfırlanır. Ona görə ayrıca
   * başlıq altında verilir, filtr kontrolları ilə qarışmasın.
   *
   * Boş facet-lər siyahıya salınmır (bax: lib/facetCatalog.ts getFacetCounts).
   */
  categoryLinks?: { path: string; label: string }[];
  /**
   * Facet landing səhifələrinin sabit filtri (məs. `/ps5-oyunlari` üçün
   * `{ platform: "PS5" }`). İstifadəçinin dəyişdiyi filtrlərin ÜSTÜNƏ deyil,
   * ONLARLA BİRLİKDƏ hər sorğuya əlavə olunur — yəni landing səhifəsində
   * "PS4" seçib kateqoriyadan çıxmaq mümkün deyil, səhifə öz mövzusunda qalır.
   */
  lockedFilters?: Record<string, string>;
}) {
  // Epic/PC mode: swaps the PlayStation type tabs + platform filter for a
  // genre/category picker, and routes requests to the Epic catalog.
  const isEpic = store === "EPIC";
  const [data, setData] = useState<ListingResponse>(initial);
  const [productType, setProductType] = useState<ProductType>(DEFAULT_TYPE);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>(defaultSort);
  const [genre, setGenre] = useState<string>("");
  const [platform, setPlatform] = useState<Platform>(DEFAULT_PLATFORM);
  const [onSale, setOnSale] = useState(false);
  // Price range filter — stored as the raw input strings so the user can
  // clear / partially type without us coercing to 0. We parse to numbers
  // only when building the request.
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  // ─── PS Store metadata filtrləri ──────────────────────────────────────────
  // Seçim siyahıları `/api/games/facets`-dən gəlir. Enricher hələ işləməyibsə
  // siyahılar boş qayıdır və müvafiq kontrol ÜMUMİYYƏTLƏ render olunmur —
  // istifadəçiyə heç vaxt nəticəsiz filtr göstərilmir.
  const [contentRating, setContentRating] = useState("");
  const [minRating, setMinRating] = useState("");
  const [publisher, setPublisher] = useState("");
  const [yearMin, setYearMin] = useState("");
  const [yearMax, setYearMax] = useState("");
  const [facets, setFacets] = useState<FilterFacets | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiSemantic, setAiSemantic] = useState(false);
  const [interpretedAs, setInterpretedAs] = useState<string | null>(null);
  const pageSize = initial.pageSize ?? DEFAULT_PAGE_SIZE;
  const [page, setPage] = useState<number>(initial.page ?? 1);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // `lockedFilters` server komponentdən gələn obyekt literalıdır — effekt
  // asılılığında birbaşa işlətsək, hər render-də yeni referans kimi görünüb
  // artıq sorğu tetikləyə bilər. Sabit sətir açarına çeviririk.
  const lockedKey = useMemo(
    () => (lockedFilters ? new URLSearchParams(lockedFilters).toString() : ""),
    [lockedFilters]
  );

  const reqId = useRef(0);
  const hasMounted = useRef(false);

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }

    const myReq = ++reqId.current;
    setLoading(true);

    const handle = setTimeout(async () => {
      const params = new URLSearchParams();
      const q = query.trim();
      const isSearching = q.length >= 2;

      if (isSearching) params.set("q", q);
      params.set("type", productType);
      if (store !== "PS") params.set("store", store);
      // Janr filtri artıq hər iki mağaza üçün işləyir: PS sətirlərinin janrları
      // scripts/enrichGameMetadata.ts ilə dolur (əvvəl yalnız Epic-də var idi).
      if (genre) params.set("genre", genre);
      if (!isEpic && platform !== "ALL") params.set("platform", platform);
      if (onSale) params.set("onSale", "1");
      if (contentRating) params.set("rating", contentRating);
      if (minRating) params.set("minRating", minRating);
      if (publisher) params.set("publisher", publisher);
      if (yearMin) params.set("yearMin", yearMin);
      if (yearMax) params.set("yearMax", yearMax);
      const pMin = Number(priceMin);
      const pMax = Number(priceMax);
      if (Number.isFinite(pMin) && pMin > 0) params.set("priceMin", String(pMin));
      if (Number.isFinite(pMax) && pMax > 0) params.set("priceMax", String(pMax));
      params.set("limit", String(pageSize));
      params.set("offset", String((page - 1) * pageSize));

      // While actively searching, hit the hybrid AI endpoint (semantic +
      // keyword). Browsing without a query keeps using /api/games so sort
      // and totals continue to work unchanged. The AI endpoint isn't
      // store-scoped, so Epic searches stay on the store-filtered /api/games
      // keyword path.
      // Sabit facet filtrləri sorğunun sonunda tətbiq olunur ki, istifadəçinin
      // seçdiyi eyniadlı filtri əvəz etsin (səhifə öz mövzusundan çıxmasın).
      if (lockedKey) {
        for (const [k, v] of new URLSearchParams(lockedKey)) params.set(k, v);
      }

      const useAi = isSearching && store === "PS";
      const endpoint = useAi ? "/api/search/ai" : "/api/games";
      if (!useAi) params.set("sort", sort);

      try {
        const res = await fetch(`${endpoint}?${params.toString()}`);
        const json = (await res.json()) as Partial<ListingResponse> & {
          semantic?: boolean;
          interpretedAs?: string | null;
        };
        if (myReq !== reqId.current) return;
        // /api/search/ai returns a subset of fields (no totalAll/totalOnSale/
        // totals — those are catalog-wide stats unrelated to the search). Merge
        // onto the previous state so the type pill counts and headline stats
        // remain populated while the user types.
        setData((prev) => ({ ...prev, ...json } as ListingResponse));
        setAiSemantic(Boolean(json.semantic));
        setInterpretedAs(isSearching ? json.interpretedAs ?? null : null);
      } catch {
        if (myReq === reqId.current) {
          setData((d) => ({ ...d, total: 0, count: 0, results: [] }));
        }
      } finally {
        if (myReq === reqId.current) setLoading(false);
      }
    }, 250);

    return () => clearTimeout(handle);
  }, [
    query, sort, platform, onSale, productType, page, pageSize, priceMin, priceMax,
    store, genre, isEpic, lockedKey,
    contentRating, minRating, publisher, yearMin, yearMax,
  ]);

  // Filtr seçim siyahılarını bir dəfə yüklə. Sorğu sınsa `facets` null qalır və
  // metadata kontrolları render olunmur — kataloq normal işləməyə davam edir.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/games/facets${store === "PS" ? "" : `?store=${store}`}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json: FilterFacets | null) => {
        if (!cancelled && json) setFacets(json);
      })
      .catch(() => {
        /* filtr siyahıları olmadan da kataloq işləyir */
      });
    return () => {
      cancelled = true;
    };
  }, [store]);

  // Filtrlər dəyişəndə ilk səhifəyə qayıt. İlk mount-da skip edirik ki,
  // sessionStorage-dan restore olunan səhifə nömrəsi sıfırlanmasın.
  const hasFilterChangedAfterMount = useRef(false);
  useEffect(() => {
    if (!hasFilterChangedAfterMount.current) {
      hasFilterChangedAfterMount.current = true;
      return;
    }
    setPage(1);
  }, [
    query, sort, platform, onSale, productType, priceMin, priceMax, genre,
    contentRating, minRating, publisher, yearMin, yearMax,
  ]);

  // Mount-dan sonra sessionStorage-dan filterləri restore et. SSR/hidrasiya
  // uyğunsuzluğunu önləmək üçün state lazy-initializer-də yox, mount effekt-ində
  // tətbiq edirik. Saxlanmış filter dəyişiklik edəcəksə, "main fetch" effekti
  // (yuxarıda) hasMounted=true halında işə düşüb yeni nəticələri çəkir.
  useEffect(() => {
    const saved = readSavedFilters(store);
    if (!saved) return;
    if (typeof saved.productType === "string") setProductType(saved.productType);
    if (typeof saved.query === "string") setQuery(saved.query);
    if (typeof saved.sort === "string") setSort(saved.sort);
    if (typeof saved.genre === "string") setGenre(saved.genre);
    if (typeof saved.platform === "string") setPlatform(saved.platform);
    if (typeof saved.onSale === "boolean") setOnSale(saved.onSale);
    if (typeof saved.priceMin === "string") setPriceMin(saved.priceMin);
    if (typeof saved.priceMax === "string") setPriceMax(saved.priceMax);
    if (typeof saved.contentRating === "string") setContentRating(saved.contentRating);
    if (typeof saved.minRating === "string") setMinRating(saved.minRating);
    if (typeof saved.publisher === "string") setPublisher(saved.publisher);
    if (typeof saved.yearMin === "string") setYearMin(saved.yearMin);
    if (typeof saved.yearMax === "string") setYearMax(saved.yearMax);
    if (typeof saved.page === "number" && saved.page >= 1) setPage(saved.page);
    // store dəyişməz: yalnız mount-da bir dəfə işləməlidir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filterləri sessionStorage-a yaz. Hər şey default-dırsa açarı sil — yeni
  // sessiyaya təmiz başlamağa imkan verir.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = filtersStorageKey(store);
    const isDefault =
      productType === DEFAULT_TYPE &&
      query === "" &&
      sort === defaultSort &&
      genre === "" &&
      platform === DEFAULT_PLATFORM &&
      onSale === false &&
      priceMin === "" &&
      priceMax === "" &&
      contentRating === "" &&
      minRating === "" &&
      publisher === "" &&
      yearMin === "" &&
      yearMax === "" &&
      page === 1;
    try {
      if (isDefault) {
        window.sessionStorage.removeItem(key);
      } else {
        window.sessionStorage.setItem(
          key,
          JSON.stringify({
            productType,
            query,
            sort,
            genre,
            platform,
            onSale,
            priceMin,
            priceMax,
            contentRating,
            minRating,
            publisher,
            yearMin,
            yearMax,
            page,
          } satisfies SavedFilters),
        );
      }
    } catch {
      /* quota / private mode — səssizcə keç */
    }
  }, [
    productType, query, sort, genre, platform, onSale, priceMin, priceMax, page,
    store, defaultSort, contentRating, minRating, publisher, yearMin, yearMax,
  ]);

  const priceMinNum = Number(priceMin);
  const priceMaxNum = Number(priceMax);
  const hasPriceMin = Number.isFinite(priceMinNum) && priceMinNum > 0;
  const hasPriceMax = Number.isFinite(priceMaxNum) && priceMaxNum > 0;

  // While the search bar is active, results come from /api/search/ai with
  // relevance ranking — the user-selected sort is intentionally ignored.
  // Surfacing this in the UI prevents the "Ən populyar" pill from looking
  // like it's filtering search hits.
  const isSearching = query.trim().length >= 2;

  const hasActiveFilter =
    query.trim().length >= 2 ||
    platform !== DEFAULT_PLATFORM ||
    onSale ||
    sort !== defaultSort ||
    hasPriceMin ||
    hasPriceMax ||
    genre !== "" ||
    contentRating !== "" ||
    minRating !== "" ||
    publisher !== "" ||
    yearMin !== "" ||
    yearMax !== "";

  const clearFilters = () => {
    setQuery("");
    setSort(defaultSort);
    setPlatform(DEFAULT_PLATFORM);
    setOnSale(false);
    setPriceMin("");
    setPriceMax("");
    setGenre("");
    setContentRating("");
    setMinRating("");
    setPublisher("");
    setYearMin("");
    setYearMax("");
    // Save effekti default vəziyyəti onsuz da silir, amma burada explicit
    // silmək gec-tezliyi aradan qaldırır (back nav-ı dərhal təmiz başladır).
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.removeItem(filtersStorageKey(store));
      } catch {
        /* keç */
      }
    }
  };

  const showingCount = useMemo(() => {
    if (sort === "discount" || sort === "discountAsc") return Math.min(data.total, data.totalOnSale);
    return data.total;
  }, [sort, data.total, data.totalOnSale]);

  const activeTab = TYPE_TABS.find((t) => t.value === productType)!;

  const activeFilterChips: { key: string; label: string; onRemove: () => void }[] = [];
  if (query.trim().length >= 2) {
    activeFilterChips.push({
      key: "q",
      label: `“${query.trim()}”`,
      onRemove: () => setQuery(""),
    });
  }
  if (!isEpic && platform !== DEFAULT_PLATFORM) {
    activeFilterChips.push({
      key: "platform",
      label: platform,
      onRemove: () => setPlatform(DEFAULT_PLATFORM),
    });
  }
  if (genre) {
    activeFilterChips.push({
      key: "genre",
      // PS janrları DB-də türkcədir (TR mağazasından gəlir) — çipdə AZ adı.
      label: isEpic ? genre : genreLabelAz(genre),
      onRemove: () => setGenre(""),
    });
  }
  if (contentRating) {
    activeFilterChips.push({
      key: "rating",
      label: contentRating,
      onRemove: () => setContentRating(""),
    });
  }
  if (minRating) {
    activeFilterChips.push({
      key: "minRating",
      label: `${minRating}+ ulduz`,
      onRemove: () => setMinRating(""),
    });
  }
  if (publisher) {
    activeFilterChips.push({
      key: "publisher",
      label: publisher,
      onRemove: () => setPublisher(""),
    });
  }
  if (yearMin || yearMax) {
    activeFilterChips.push({
      key: "year",
      label: `${yearMin || "…"} – ${yearMax || "…"}`,
      onRemove: () => {
        setYearMin("");
        setYearMax("");
      },
    });
  }
  if (onSale) {
    activeFilterChips.push({
      key: "onSale",
      label: "Endirimdə",
      onRemove: () => setOnSale(false),
    });
  }
  if (sort !== defaultSort) {
    activeFilterChips.push({
      key: "sort",
      label: SORT_OPTIONS.find((s) => s.value === sort)?.label ?? sort,
      onRemove: () => setSort(DEFAULT_SORT),
    });
  }
  if (hasPriceMin || hasPriceMax) {
    // Single chip for the whole range — clearing it wipes both bounds at
    // once, which matches what users expect when they "remove" the range.
    const fromTxt = hasPriceMin ? `${priceMinNum} ₼` : "0 ₼";
    const toTxt = hasPriceMax ? `${priceMaxNum} ₼` : "∞";
    activeFilterChips.push({
      key: "price",
      label: `${fromTxt} – ${toTxt}`,
      onRemove: () => {
        setPriceMin("");
        setPriceMax("");
      },
    });
  }
  const advancedFilterCount = [
    !isEpic && platform !== DEFAULT_PLATFORM,
    genre !== "",
    onSale,
    sort !== defaultSort,
    hasPriceMin || hasPriceMax,
    contentRating !== "",
    minRating !== "",
    publisher !== "",
    yearMin !== "" || yearMax !== "",
  ].filter(Boolean).length;

  // Janr siyahısı: Epic-də prop ilə gələn kateqoriyalar, PS-də isə
  // `/api/games/facets`-dən (DB-də real mövcud janrlar + sayları).
  const genreOptions = isEpic
    ? categories.map((c) => ({ value: c, label: c, count: null as number | null }))
    : (facets?.genres ?? []).map((g) => ({
        value: g.value,
        label: genreLabelAz(g.value),
        count: g.count,
      }));

  return (
    <>
      <section className="relative z-40 mb-5 overflow-visible rounded-2xl border border-zinc-200 bg-white p-3 shadow-[0_16px_48px_-38px_rgba(15,23,42,0.5)] dark:border-white/10 dark:bg-[#0c0b12] dark:shadow-[0_20px_60px_-42px_rgba(0,0,0,0.9)] sm:rounded-3xl sm:p-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className={`-mx-1 overflow-x-auto px-1 pb-1 ${isEpic ? "hidden" : ""}`}>
              <div className="flex min-w-max gap-2">
                {TYPE_TABS.map((tab) => {
                  const count =
                    tab.value === "ALL"
                      ? Object.values(data.totals ?? {}).reduce(
                          (acc, n) => acc + (typeof n === "number" ? n : 0),
                          0,
                        )
                      : data.totals?.[tab.value] ?? 0;
                  const active = tab.value === productType;
                  const a = ACCENT_STYLES[tab.accent];
                  return (
                    <button
                      key={tab.value}
                      type="button"
                      onClick={() => setProductType(tab.value)}
                      className={`group relative inline-flex h-10 shrink-0 items-center gap-1.5 overflow-hidden rounded-xl border px-2.5 text-xs font-semibold transition-all duration-200 sm:h-11 sm:gap-2 sm:rounded-2xl sm:px-3 sm:text-sm ${
                        active
                          ? `${a.activeWrap} ${a.activeText} ${a.glow}`
                          : "border-zinc-200 bg-white/70 text-zinc-700 hover:-translate-y-0.5 hover:border-violet-300 hover:bg-white dark:border-zinc-700/80 dark:bg-zinc-950/[0.45] dark:text-zinc-300 dark:hover:border-violet-300/[0.35] dark:hover:bg-white/[0.07] dark:hover:text-zinc-100"
                      }`}
                    >
                      <span
                        className={`grid h-6 w-6 place-items-center rounded-lg ring-1 transition sm:h-7 sm:w-7 sm:rounded-xl ${
                          active
                            ? a.activeIcon
                            : `bg-zinc-100 text-zinc-500 ring-zinc-200 dark:bg-white/[0.06] dark:text-zinc-400 dark:ring-white/10 ${a.hoverIcon}`
                        }`}
                      >
                        {tab.icon}
                      </span>
                      <span className="tracking-tight">{tab.label}</span>
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[10px] font-black tabular-nums sm:rounded-lg sm:px-2 sm:py-1 sm:text-xs ${
                          active ? a.activeBadge : "bg-zinc-100 text-zinc-500 dark:bg-white/[0.08] dark:text-zinc-400"
                        }`}
                      >
                        {count.toLocaleString("en-US")}
                      </span>
                      {active && (
                        <span
                          aria-hidden
                          className={`absolute inset-x-4 -bottom-px h-px bg-gradient-to-r from-transparent via-current to-transparent ${a.activeText} opacity-70`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="hidden sm:inline">Kataloqda</span>
              <strong className="tabular-nums text-zinc-900 dark:text-zinc-100">{data.totalAll.toLocaleString("en-US")}</strong>
              <span className="hidden sm:inline">məhsul</span>
              {data.totalOnSale > 0 && (
                <button
                  type="button"
                  onClick={() => setOnSale((value) => !value)}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 font-semibold transition ${
                    onSale
                      ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-300"
                      : "border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-600 hover:border-emerald-400/50 dark:text-emerald-300"
                  }`}
                >
                  <Tag className="h-3.5 w-3.5" />
                  {data.totalOnSale.toLocaleString("en-US")} endirimdə
                </button>
              )}
            </div>
          </div>

          <div className="border-t border-zinc-100 pt-4 dark:border-white/[0.07]">
            <div className="grid grid-cols-[1fr_auto] gap-2 lg:grid-cols-[minmax(280px,1fr)_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-zinc-400 sm:left-4" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`${activeTab.singular} adı, janrı və ya seriyası ilə axtar...`}
                className="h-10 w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-9 text-sm text-zinc-950 outline-none transition placeholder:text-slate-400 focus:border-violet-400/70 focus:bg-white focus:ring-4 focus:ring-violet-500/10 dark:border-zinc-700/80 dark:bg-zinc-950/70 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] dark:focus:border-violet-300/60 dark:focus:bg-zinc-950 dark:focus:ring-violet-400/[0.14] sm:h-11 sm:rounded-2xl sm:pl-11 sm:pr-11"
              />
              {loading ? (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-indigo-400 sm:right-4" />
              ) : query.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Axtarışı təmizlə"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-white/10 dark:hover:text-zinc-200 sm:right-3"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              aria-expanded={filtersOpen}
              aria-label="Filter et"
              className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border px-2.5 text-xs font-bold transition sm:h-11 sm:gap-2 sm:rounded-2xl sm:px-4 sm:text-sm sm:font-black ${
                filtersOpen
                  ? "border-violet-300 bg-violet-50 text-violet-800 ring-4 ring-violet-500/10 dark:border-violet-300/[0.55] dark:bg-violet-400/[0.16] dark:text-violet-50 dark:ring-violet-300/[0.12]"
                  : "border-zinc-200 bg-white text-zinc-800 hover:border-violet-300 hover:bg-violet-50 dark:border-zinc-700/80 dark:bg-zinc-950/70 dark:text-zinc-100 dark:hover:border-violet-300/[0.35] dark:hover:bg-white/[0.07]"
              }`}
            >
              <Filter className="h-4 w-4 text-violet-600 dark:text-violet-300" />
              <span className="hidden sm:inline">Bütün filtrlər</span>
              {advancedFilterCount > 0 && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-violet-500 px-1.5 text-[11px] text-white">
                  {advancedFilterCount}
                </span>
              )}
              <ChevronDown
                className={`h-4 w-4 text-zinc-500 transition-transform ${
                  filtersOpen ? "rotate-180 text-violet-600 dark:text-violet-300" : ""
                }`}
              />
            </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="mr-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">Sürətli seçimlər:</span>
              <button
                type="button"
                onClick={() => setOnSale((value) => !value)}
                aria-pressed={onSale}
                className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition ${
                  onSale
                    ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-200"
                    : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300 dark:hover:border-emerald-400/30 dark:hover:bg-emerald-500/[0.1] dark:hover:text-emerald-200"
                }`}
              >
                <Tag className="h-3.5 w-3.5" /> Endirimdə
                {onSale && <Check className="h-3.5 w-3.5" />}
              </button>
              {!isEpic && ["PS5", "PS4"].map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setPlatform(platform === item ? "ALL" : (item as Platform))}
                  aria-pressed={platform === item}
                  className={`inline-flex h-8 items-center rounded-full border px-3 text-xs font-semibold transition ${
                    platform === item
                      ? "border-violet-400/50 bg-violet-500/15 text-violet-700 dark:text-violet-200"
                      : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-violet-300 hover:bg-violet-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300 dark:hover:border-violet-400/30 dark:hover:bg-violet-500/[0.1]"
                  }`}
                >
                  {item}
                </button>
              ))}
              {/* Ən böyük 4 janr sürətli seçim kimi. Dropdown-u açmadan bir
                  klikə kataloqu daraltmağa imkan verir — janr datası indi
                  onsuz da kartlarda görünür, filtr də əlçatan olmalıdır. */}
              {genreOptions.slice(0, 4).map((g) => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => setGenre(genre === g.value ? "" : g.value)}
                  aria-pressed={genre === g.value}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition ${
                    genre === g.value
                      ? "border-indigo-400/50 bg-indigo-500/15 text-indigo-700 dark:text-indigo-200"
                      : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-indigo-300 hover:bg-indigo-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300 dark:hover:border-indigo-400/30 dark:hover:bg-indigo-500/[0.1]"
                  }`}
                >
                  {g.label}
                  {genre === g.value && <Check className="h-3.5 w-3.5" />}
                </button>
              ))}
              {aiSemantic && isSearching && (
                <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-violet-500/[0.1] px-3 text-xs font-medium text-violet-700 dark:text-violet-200">
                  <Sparkles className="h-3.5 w-3.5" /> AI uyğunluğu
                </span>
              )}
            </div>
          </div>

          {activeFilterChips.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {activeFilterChips.map((chip) => (
                <span
                  key={chip.key}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-2.5 text-xs font-semibold text-violet-800 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-100"
                >
                  {chip.label}
                  <button
                    type="button"
                    onClick={chip.onRemove}
                    aria-label={`${chip.label} filtrini sil`}
                    className="rounded-full p-0.5 transition hover:bg-violet-100 dark:hover:bg-violet-500/20"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex h-8 items-center rounded-full px-2 text-xs font-semibold text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-200"
              >
                Hamısını təmizlə
              </button>
            </div>
          )}

          {filtersOpen && (
            <div className="space-y-4 rounded-2xl border border-violet-200/70 bg-violet-50/40 p-4 dark:border-violet-400/[0.18] dark:bg-violet-500/[0.06] sm:rounded-3xl sm:p-5">
              {/* Each control gets an explicit Azerbaijani label above it so a
                  first-time visitor doesn't have to guess what each dropdown
                  does. The label-on-top layout also reads well on mobile. */}
              <div className="grid gap-4 md:grid-cols-2">
                {!isEpic && (
                  <FilterField label="Platforma">
                    <div className="grid grid-cols-[1fr_auto] gap-2">
                      <Dropdown
                        value={platform}
                        onChange={(v) => setPlatform(v as Platform)}
                        options={[
                          { value: "ALL", label: "Bütün platformalar" },
                          { value: "PS5", label: "PS5" },
                          { value: "PS4", label: "PS4" },
                        ]}
                        ariaLabel="Platforma"
                        align="end"
                      />
                      <PlatformInfoButton className="h-11 w-11 rounded-xl border-zinc-200 bg-white text-zinc-600 hover:bg-violet-50 hover:text-violet-700 dark:border-white/10 dark:bg-black/25 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white" />
                    </div>
                  </FilterField>
                )}

                {/* Janr — PS tərəfdə siyahı DB-dəki real janrlardan qurulur
                    (scripts/enrichGameMetadata.ts doldurur). Data yoxdursa
                    kontrol ümumiyyətlə göstərilmir ki, istifadəçi boş nəticə
                    verən filtrlə üz-üzə qalmasın. */}
                {genreOptions.length > 0 && (
                  <FilterField label={isEpic ? "Kateqoriya" : "Janr"}>
                    <Dropdown
                      value={genre}
                      onChange={(v) => setGenre(v)}
                      options={[
                        { value: "", label: isEpic ? "Bütün kateqoriyalar" : "Bütün janrlar" },
                        ...genreOptions.map((g) => ({
                          value: g.value,
                          label:
                            g.count != null
                              ? `${g.label} (${g.count.toLocaleString("en-US")})`
                              : g.label,
                        })),
                      ]}
                      ariaLabel={isEpic ? "Kateqoriya" : "Janr"}
                      align="end"
                    />
                  </FilterField>
                )}

                <FilterField label="Endirim">
                  <button
                    type="button"
                    onClick={() => setOnSale((v) => !v)}
                    className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold transition ${
                      onSale
                        ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-400/[0.55] dark:bg-emerald-500/[0.15] dark:text-emerald-200"
                        : "border-zinc-200 bg-white text-zinc-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 dark:border-white/10 dark:bg-black/25 dark:text-zinc-300 dark:hover:border-emerald-400/30 dark:hover:bg-white/[0.055] dark:hover:text-emerald-200"
                    }`}
                  >
                    <Tag className={`h-4 w-4 ${onSale ? "text-emerald-600 dark:text-emerald-300" : "text-zinc-500"}`} />
                    {onSale ? "Yalnız endirimlilər" : "Bütün oyunlar"}
                    {onSale && <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />}
                  </button>
                </FilterField>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
              <FilterField label="Qiymət (AZN)">
                <div className="flex items-center gap-2">
                  <PriceInput
                    value={priceMin}
                    onChange={setPriceMin}
                    placeholder="Min"
                    ariaLabel="Minimum qiymət (AZN)"
                  />
                  <span className="text-zinc-400 dark:text-zinc-600">–</span>
                  <PriceInput
                    value={priceMax}
                    onChange={setPriceMax}
                    placeholder="Max"
                    ariaLabel="Maksimum qiymət (AZN)"
                  />
                  {(hasPriceMin || hasPriceMax) && (
                    <button
                      type="button"
                      onClick={() => {
                        setPriceMin("");
                        setPriceMax("");
                      }}
                      className="rounded-lg px-2 py-1.5 text-xs font-semibold text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-200"
                    >
                      Sıfırla
                    </button>
                  )}
                </div>
              </FilterField>

              {/* Yaş həddi (PEGI). Valideynlər üçün kataloqun ən çox soruşulan
                  filtridir və data indiyədək yalnız oyunun daxili səhifəsində
                  görünürdü. */}
              {(facets?.contentRatings.length ?? 0) > 0 && (
                <FilterField label="Yaş həddi (PEGI)">
                  <Dropdown
                    value={contentRating}
                    onChange={setContentRating}
                    options={[
                      { value: "", label: "Bütün yaş qrupları" },
                      ...facets!.contentRatings.map((r) => ({
                        value: r.value,
                        label: `${r.value} (${r.count.toLocaleString("en-US")})`,
                      })),
                    ]}
                    ariaLabel="Yaş həddi"
                    align="end"
                  />
                </FilterField>
              )}
              </div>

              {/* PS Store reytinqi + nəşriyyatçı + çıxış ili. Üçü də detal
                  səhifəsi metadata-sıdır; sətir zənginləşdirilməyibsə həmin
                  filtr onu KƏNARLAŞDIRIR (bax: lib/gameQuery.ts). */}
              {(facets?.publishers.length ?? 0) > 0 || facets?.releaseYears ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <FilterField label="Minimum PS Store reytinqi">
                    <Dropdown
                      value={minRating}
                      onChange={setMinRating}
                      options={MIN_RATING_OPTIONS}
                      ariaLabel="Minimum reytinq"
                      align="end"
                    />
                  </FilterField>

                  {(facets?.publishers.length ?? 0) > 0 && (
                    <FilterField label="Nəşriyyatçı">
                      <Dropdown
                        value={publisher}
                        onChange={setPublisher}
                        options={[
                          { value: "", label: "Bütün nəşriyyatçılar" },
                          ...facets!.publishers.map((p) => ({
                            value: p.value,
                            label: `${p.value} (${p.count.toLocaleString("en-US")})`,
                          })),
                        ]}
                        ariaLabel="Nəşriyyatçı"
                        align="end"
                      />
                    </FilterField>
                  )}

                  {facets?.releaseYears && (
                    <FilterField label="Çıxış ili">
                      <div className="flex items-center gap-2">
                        <YearInput
                          value={yearMin}
                          onChange={setYearMin}
                          placeholder={String(facets.releaseYears.min)}
                          ariaLabel="Ən erkən çıxış ili"
                        />
                        <span className="text-zinc-400 dark:text-zinc-600">–</span>
                        <YearInput
                          value={yearMax}
                          onChange={setYearMax}
                          placeholder={String(facets.releaseYears.max)}
                          ariaLabel="Ən son çıxış ili"
                        />
                        {(yearMin || yearMax) && (
                          <button
                            type="button"
                            onClick={() => {
                              setYearMin("");
                              setYearMax("");
                            }}
                            className="rounded-lg px-2 py-1.5 text-xs font-semibold text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-200"
                          >
                            Sıfırla
                          </button>
                        )}
                      </div>
                    </FilterField>
                  )}
                </div>
              ) : null}

              {categoryLinks.length > 0 && (
                <div className="border-t border-zinc-200 pt-4 dark:border-white/5">
                  <FilterField label="Kateqoriyalar">
                    <ul className="flex flex-wrap gap-2">
                      {categoryLinks.map((c) => (
                        <li key={c.path}>
                          <Link
                            href={`/${c.path}`}
                            className="inline-flex items-center rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 dark:border-white/10 dark:bg-black/25 dark:text-zinc-300 dark:hover:border-violet-400/30 dark:hover:bg-white/[0.055] dark:hover:text-violet-200"
                          >
                            {c.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </FilterField>
                </div>
              )}

              {hasActiveFilter && (
                <div className="flex justify-end border-t border-zinc-200 pt-3 dark:border-white/5">
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-950 dark:border-white/10 dark:bg-black/25 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                    Bütün filtrləri təmizlə
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {interpretedAs && query.trim().length >= 2 && !loading && (
        <div className="mb-3 flex items-center gap-1.5 px-1 text-xs text-zinc-600 dark:text-zinc-400">
          <Sparkles className="h-3 w-3 text-violet-600 dark:text-violet-300" />
          <span>
            <span className="text-zinc-500">“{query.trim()}”</span> →{" "}
            <span className="font-medium text-zinc-900 dark:text-zinc-200">{interpretedAs}</span>
          </span>
        </div>
      )}

      <div className="relative">
        {loading && <ProgressBar />}

        <div className="mb-4 flex flex-wrap items-end justify-between gap-3 px-0.5">
          <div>
            <p className="text-lg font-bold tracking-tight text-zinc-950 dark:text-white">
              {loading ? "Nəticələr yenilənir" : `${showingCount.toLocaleString("en-US")} nəticə`}
            </p>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              {isSearching ? "Axtarışınıza ən uyğun oyunlar" : onSale ? "Hazırda endirimdə olan oyunlar" : "Kataloqdan seçilmiş oyunlar"}
            </p>
          </div>
          {!isSearching && (
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-zinc-400" />
              <Dropdown
                value={sort}
                onChange={(v) => setSort(v as Sort)}
                options={SORT_OPTIONS.map((s) => ({ value: s.value, label: s.label }))}
                ariaLabel="Nəticələri sırala"
                align="end"
              />
            </div>
          )}
        </div>

        {loading && data.results.length === 0 ? (
          <SkeletonGrid />
        ) : data.results.length === 0 ? (
          <EmptyState query={query} hasActiveFilter={hasActiveFilter} onClear={clearFilters} />
        ) : (
          <ul
            className={`grid grid-cols-2 gap-3 transition duration-200 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4 ${
              loading ? "pointer-events-none opacity-50" : "opacity-100"
            }`}
            aria-busy={loading}
          >
            {data.results.map((g, i) => (
              <GameCard key={g.id} game={g} priority={i < 4} />
            ))}
          </ul>
        )}
      </div>

      <Pagination
        page={page}
        totalPages={data.totalPages ?? Math.max(1, Math.ceil((data.total || 0) / pageSize))}
        loading={loading}
        onPageChange={setPage}
      />
    </>
  );
}

/**
 * Vertical "label above input" wrapper for filter controls. The point of this
 * tiny abstraction is consistency: every filter in the open panel uses the
 * same label styling, so users learn the pattern once and can scan all the
 * controls quickly. Replaces the previous icon-only dropdowns where it
 * wasn't obvious what each control did.
 */
function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-600 dark:text-zinc-500">
        {label}
      </span>
      {children}
    </label>
  );
}

/**
 * Compact numeric input used for the price-range bounds. `inputMode="decimal"`
 * surfaces the right phone keypad on mobile; `type="text"` (not "number") lets
 * us keep the value as a string so the user can clear/partially-type without
 * the browser coercing or stripping leading zeros. Sanitization is permissive:
 * digits and one dot only.
 */
function PriceInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  ariaLabel: string;
}) {
  return (
    <input
      type="text"
      inputMode="decimal"
      value={value}
      onChange={(e) => {
        // Permit digits, a single dot/comma, and an empty string. Normalize
        // comma → dot so AZ locale input still parses to Number() cleanly.
        const raw = e.target.value.replace(/,/g, ".").replace(/[^\d.]/g, "");
        // Collapse multiple dots — keep only the first.
        const parts = raw.split(".");
        const clean = parts.length > 1 ? `${parts[0]}.${parts.slice(1).join("")}` : raw;
        onChange(clean);
      }}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className="h-10 w-24 rounded-xl border border-zinc-200 bg-white px-3 text-sm tabular-nums text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-violet-400/70 focus:bg-white focus:ring-4 focus:ring-violet-500/10 dark:border-white/10 dark:bg-black/25 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-violet-400/60 dark:focus:bg-black/[0.35]"
    />
  );
}

/**
 * Çıxış ili üçün 4 rəqəmli giriş. Qiymət sahəsi ilə eyni məntiq: dəyər sətir
 * kimi saxlanılır ki, istifadəçi yazarkən (məs. "20") sahə sıfırlanmasın.
 */
function YearInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  ariaLabel: string;
}) {
  return (
    <input
      type="text"
      inputMode="numeric"
      maxLength={4}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, "").slice(0, 4))}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className="h-10 w-24 rounded-xl border border-zinc-200 bg-white px-3 text-sm tabular-nums text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-violet-400/70 focus:bg-white focus:ring-4 focus:ring-violet-500/10 dark:border-white/10 dark:bg-black/25 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-violet-400/60 dark:focus:bg-black/[0.35]"
    />
  );
}

function ProgressBar() {
  return (
    <div className="absolute -top-1 left-0 right-0 z-10 h-0.5 overflow-hidden rounded-full bg-zinc-800/60">
      <div className="ps-progress h-full w-1/3 rounded-full bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-indigo-500" />
      <style jsx>{`
        .ps-progress {
          animation: ps-progress 1.1s ease-in-out infinite;
        }
        @keyframes ps-progress {
          0% {
            transform: translateX(-100%);
          }
          50% {
            transform: translateX(150%);
          }
          100% {
            transform: translateX(350%);
          }
        }
      `}</style>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <ul
      aria-hidden
      className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4"
    >
      {Array.from({ length: 8 }).map((_, i) => (
        <li
          key={i}
          className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40"
        >
          <div className="aspect-square w-full animate-pulse bg-zinc-800/60" />
          <div className="space-y-3 p-4">
            <div className="h-4 w-4/5 animate-pulse rounded bg-zinc-800/70" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-zinc-800/70" />
            <div className="h-7 w-1/2 animate-pulse rounded bg-zinc-800/80" />
            <div className="h-9 w-full animate-pulse rounded bg-zinc-800/60" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Dropdown({
  icon,
  value,
  onChange,
  options,
  ariaLabel,
  align = "start",
}: {
  /** Optional leading icon. With explicit text labels now sitting ABOVE each
   * dropdown via FilterField, the icon is redundant and we can drop it. */
  icon?: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  ariaLabel: string;
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % options.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + options.length) % options.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const opt = options[activeIndex];
        if (opt) {
          onChange(opt.value);
          setOpen(false);
        }
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, options, activeIndex, onChange]);

  useEffect(() => {
    if (open) {
      const i = options.findIndex((o) => o.value === value);
      setActiveIndex(i >= 0 ? i : 0);
    }
  }, [open, options, value]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        className={`group inline-flex h-11 w-full min-w-[10rem] items-center gap-2 rounded-xl border bg-white pl-3 pr-3 text-sm font-semibold text-zinc-950 transition hover:border-violet-300 hover:bg-violet-50 dark:bg-black/25 dark:text-zinc-100 dark:hover:border-violet-400/30 dark:hover:bg-white/[0.055] ${
          open
            ? "border-violet-400/70 bg-violet-50 ring-4 ring-violet-500/10 dark:border-violet-400/60 dark:bg-black/[0.35]"
            : "border-zinc-200 dark:border-white/10"
        }`}
      >
        {icon && (
          <span className="text-zinc-500 transition group-hover:text-violet-600 dark:group-hover:text-violet-300">{icon}</span>
        )}
        <span className="flex-1 truncate text-left">{selected?.label}</span>
        <ChevronDown
          className={`h-4 w-4 text-zinc-500 transition-transform duration-200 ${
            open ? "rotate-180 text-violet-300" : ""
          }`}
        />
      </button>

      {open && (
        <div
          ref={listRef}
          role="listbox"
          aria-label={ariaLabel}
          className={`absolute z-[60] mt-2 min-w-full origin-top overflow-hidden rounded-2xl border border-violet-200 bg-white/95 p-1.5 shadow-2xl shadow-slate-900/15 ring-1 ring-slate-900/5 backdrop-blur dark:border-violet-400/25 dark:bg-zinc-950/95 dark:shadow-black/60 dark:ring-black/40 ${
            align === "end" ? "right-0" : "left-0"
          }`}
          style={{ animation: "dropdown-in 140ms ease-out" }}
        >
          {options.map((o, i) => {
            const isSelected = o.value === value;
            const isActive = i === activeIndex;
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-left text-sm transition ${
                  isSelected
                    ? "bg-violet-50 text-violet-800 dark:bg-violet-500/[0.15] dark:text-violet-100"
                    : isActive
                      ? "bg-zinc-100 text-zinc-950 dark:bg-white/[0.07] dark:text-zinc-100"
                      : "text-zinc-700 dark:text-zinc-300"
                }`}
              >
                <span>{o.label}</span>
                {isSelected ? (
                  <Check className="h-4 w-4 text-violet-600 dark:text-violet-300" />
                ) : (
                  <span className="h-4 w-4" />
                )}
              </button>
            );
          })}
          <style jsx>{`
            @keyframes dropdown-in {
              from {
                opacity: 0;
                transform: translateY(-4px) scale(0.98);
              }
              to {
                opacity: 1;
                transform: translateY(0) scale(1);
              }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}

function EmptyState({
  query,
  hasActiveFilter,
  onClear,
}: {
  query: string;
  hasActiveFilter: boolean;
  onClear: () => void;
}) {
  if (hasActiveFilter) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-10 text-center">
        <Search className="mx-auto h-10 w-10 text-zinc-600" />
        <p className="mt-3 text-sm text-zinc-300">
          {query.trim().length >= 2
            ? `“${query.trim()}” üzrə nəticə tapılmadı.`
            : "Seçilmiş filtrlərə uyğun nəticə tapılmadı."}
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Filtrləri sıfırlayıb yenidən cəhd edin.
        </p>
        <button
          type="button"
          onClick={onClear}
          className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
        >
          <X className="h-4 w-4" /> Filtrləri sıfırla
        </button>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-10 text-center">
      <Gamepad2 className="mx-auto h-10 w-10 text-zinc-600" />
      <p className="mt-3 text-sm text-zinc-400">
        Bu kateqoriyada hələ məhsul yoxdur.
      </p>
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  loading,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  loading: boolean;
  onPageChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;

  const clampedPage = Math.min(Math.max(1, page), totalPages);
  const canPrev = clampedPage > 1 && !loading;
  const canNext = clampedPage < totalPages && !loading;

  // Keep the UI stable if page got out-of-range after filtering.
  if (clampedPage !== page) {
    queueMicrotask(() => onPageChange(clampedPage));
  }

  const pages: number[] = [];
  const push = (p: number) => {
    if (p >= 1 && p <= totalPages && !pages.includes(p)) pages.push(p);
  };
  push(1);
  push(clampedPage - 1);
  push(clampedPage);
  push(clampedPage + 1);
  push(totalPages);
  pages.sort((a, b) => a - b);

  return (
    <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
      <button
        type="button"
        disabled={!canPrev}
        onClick={() => onPageChange(clampedPage - 1)}
        className={`rounded-lg border px-3 py-2 text-sm transition ${
          canPrev
            ? "border-zinc-800 bg-zinc-950/60 text-zinc-200 hover:bg-zinc-900"
            : "border-zinc-900 bg-zinc-950/40 text-zinc-600"
        }`}
      >
        Əvvəlki
      </button>

      <div className="flex items-center gap-1">
        {pages.map((p, idx) => {
          const prev = pages[idx - 1];
          const showDots = idx > 0 && prev !== undefined && p - prev > 1;
          return (
            <span key={p} className="flex items-center gap-1">
              {showDots && <span className="px-1 text-zinc-600">…</span>}
              <button
                type="button"
                disabled={loading}
                onClick={() => onPageChange(p)}
                className={`min-w-[2.5rem] rounded-lg border px-3 py-2 text-sm font-semibold tabular-nums transition ${
                  p === clampedPage
                    ? "border-indigo-500/60 bg-indigo-500/10 text-indigo-100 shadow-[0_6px_24px_-14px_rgba(99,102,241,0.7)]"
                    : "border-zinc-800 bg-zinc-950/60 text-zinc-200 hover:bg-zinc-900"
                } ${loading ? "opacity-60" : ""}`}
                aria-current={p === clampedPage ? "page" : undefined}
              >
                {p}
              </button>
            </span>
          );
        })}
      </div>

      <button
        type="button"
        disabled={!canNext}
        onClick={() => onPageChange(clampedPage + 1)}
        className={`rounded-lg border px-3 py-2 text-sm transition ${
          canNext
            ? "border-zinc-800 bg-zinc-950/60 text-zinc-200 hover:bg-zinc-900"
            : "border-zinc-900 bg-zinc-950/40 text-zinc-600"
        }`}
      >
        Növbəti
      </button>

      <span className="ml-1 text-xs text-zinc-500">
        Səhifə <span className="font-bold text-zinc-200">{clampedPage}</span> /{" "}
        <span className="font-bold text-zinc-200">{totalPages}</span>
      </span>
    </div>
  );
}
