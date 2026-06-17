// Banner mətn blokunun mövqeyi (9-nöqtəli ızgara) və mətn teması üçün paylaşılan
// məntiq. Həm storefront (HomeBannerSlider), həm də admin ön-izləməsi eyni
// class-ları istifadə edir ki, admin-də görünən nəticə saytdakı ilə eyni olsun.
//
// QEYD: bu fayl `components/` altındadır ki, Tailwind onun içindəki class
// literallarını skan edib saxlasın (tailwind.config content-ə `./lib` daxil deyil).

export type BannerPosition =
  | "TOP_LEFT" | "TOP_CENTER" | "TOP_RIGHT"
  | "MIDDLE_LEFT" | "MIDDLE_CENTER" | "MIDDLE_RIGHT"
  | "BOTTOM_LEFT" | "BOTTOM_CENTER" | "BOTTOM_RIGHT";

export type BannerTheme = "LIGHT" | "DARK";

// 9-nöqtəli ızgara — admin-dəki düymə düzülüşü ilə eyni sıra (yuxarıdan aşağı,
// soldan sağa).
export const BANNER_POSITIONS: { key: BannerPosition; label: string }[] = [
  { key: "TOP_LEFT", label: "Yuxarı sol" },
  { key: "TOP_CENTER", label: "Yuxarı mərkəz" },
  { key: "TOP_RIGHT", label: "Yuxarı sağ" },
  { key: "MIDDLE_LEFT", label: "Orta sol" },
  { key: "MIDDLE_CENTER", label: "Orta mərkəz" },
  { key: "MIDDLE_RIGHT", label: "Orta sağ" },
  { key: "BOTTOM_LEFT", label: "Aşağı sol" },
  { key: "BOTTOM_CENTER", label: "Aşağı mərkəz" },
  { key: "BOTTOM_RIGHT", label: "Aşağı sağ" },
];

const POSITION_SET = new Set<string>(BANNER_POSITIONS.map((p) => p.key));

export function normalizeBannerPosition(v: string | null | undefined): BannerPosition {
  return v && POSITION_SET.has(v) ? (v as BannerPosition) : "BOTTOM_LEFT";
}

export function normalizeBannerTheme(v: string | null | undefined): BannerTheme {
  return v === "DARK" ? "DARK" : "LIGHT";
}

// Hər mövqe üçün TAM yerləşmə dəsti (top/bottom/left/right + translate + align).
// Bütün xüsusiyyətlər açıq yazılır (auto/0 daxil) ki, desktop dəyəri sm:
// breakpoint-də mobil dəyəri tamamilə əvəz edə bilsin (qalıq qarışıqlıq olmasın).
const VERT_FULL: Record<string, string[]> = {
  TOP: ["top-0", "bottom-auto", "translate-y-0", "pt-6", "pb-0"],
  MIDDLE: ["top-1/2", "bottom-auto", "-translate-y-1/2", "pt-0", "pb-0"],
  BOTTOM: ["top-auto", "bottom-0", "translate-y-0", "pt-0", "pb-10"],
};
const HORZ_FULL: Record<string, string[]> = {
  LEFT: ["left-0", "right-auto", "translate-x-0", "items-start", "text-left"],
  CENTER: ["left-1/2", "right-auto", "-translate-x-1/2", "items-center", "text-center"],
  RIGHT: ["left-auto", "right-0", "translate-x-0", "items-end", "text-right"],
};

function axisClasses(position: string, prefix: string): string {
  const [v, h] = normalizeBannerPosition(position).split("_");
  return [...VERT_FULL[v], ...HORZ_FULL[h]]
    .map((c) => (prefix ? `${prefix}${c}` : c))
    .join(" ");
}

/**
 * Mətn blokunun yerləşmə class-ı — mobil (base) və desktop (`sm:`) üçün ayrıca
 * mövqe. Mobil dəyəri kiçik ekranda, desktop dəyəri `sm:`-dən yuxarı tətbiq olunur.
 */
export function bannerContentWrapClass(desktopPosition: string, mobilePosition: string): string {
  return [
    "absolute z-10 flex flex-col",
    "max-w-[88%] sm:max-w-[68%] lg:max-w-[560px] xl:max-w-[620px]",
    "px-5 sm:px-10",
    axisClasses(mobilePosition, ""),
    axisClasses(desktopPosition, "sm:"),
  ].join(" ");
}

export type BannerThemeClasses = {
  gradient: string;
  title: string;
  subtitle: string;
  priceFinal: string;
  priceOriginal: string;
  chip: string;
  platformChip: string;
};

const LIGHT_THEME: BannerThemeClasses = {
  gradient:
    "bg-gradient-to-t from-black/90 via-black/45 to-transparent sm:bg-gradient-to-r sm:from-black/85 sm:via-black/35 sm:to-transparent",
  title: "text-white drop-shadow-lg",
  subtitle: "text-zinc-200 drop-shadow",
  priceFinal: "text-white",
  priceOriginal: "text-zinc-300",
  chip: "border-white/20 bg-black/35 text-zinc-200",
  platformChip: "border-white/35 bg-white/10 text-white",
};

const DARK_THEME: BannerThemeClasses = {
  gradient:
    "bg-gradient-to-t from-white/90 via-white/50 to-transparent sm:bg-gradient-to-r sm:from-white/85 sm:via-white/45 sm:to-transparent",
  title: "text-zinc-900",
  subtitle: "text-zinc-700",
  priceFinal: "text-zinc-900",
  priceOriginal: "text-zinc-500",
  chip: "border-black/10 bg-white/60 text-zinc-800",
  platformChip: "border-black/15 bg-black/5 text-zinc-800",
};

/** Verilmiş temaya görə (açıq/tünd mətn) class dəsti. */
export function bannerThemeClasses(theme: string): BannerThemeClasses {
  return normalizeBannerTheme(theme) === "DARK" ? DARK_THEME : LIGHT_THEME;
}

// ─── Admin ön-izləməsi üçün (responsiv prefiksiz) ────────────────────────────
// Ön-izləmə qutusu kiçikdir, amma Tailwind breakpoint-ləri viewport-a baxır —
// ona görə storefront-un `sm:`/`lg:` class-ları kiçik qutuda yanlış görünər.
// Burada yalnız baza class-ları ilə (mövqe + tema) təxmini, lakin dəqiq
// yerləşdirməni göstəririk.

const PV_VERTICAL: Record<string, string> = {
  TOP: "top-0 pt-4",
  MIDDLE: "top-1/2 -translate-y-1/2",
  BOTTOM: "bottom-0 pb-4",
};

const PV_HORIZONTAL: Record<string, string> = {
  LEFT: "left-0 px-4 items-start text-left",
  CENTER: "left-1/2 -translate-x-1/2 px-4 items-center text-center",
  RIGHT: "right-0 px-4 items-end text-right",
};

/** Ön-izləmə üçün mətn blokunun yerləşmə class-ı (responsiv prefiksiz). */
export function bannerPreviewWrapClass(position: string): string {
  const pos = normalizeBannerPosition(position);
  const [v, h] = pos.split("_");
  return `absolute z-10 flex flex-col max-w-[80%] ${PV_VERTICAL[v]} ${PV_HORIZONTAL[h]}`;
}

/** Ön-izləmə üçün gradient (cihaza görə istiqamət, temaya görə rəng). */
export function bannerPreviewGradient(theme: string, device: "desktop" | "mobile"): string {
  const dark = normalizeBannerTheme(theme) === "DARK";
  const dir = device === "mobile" ? "bg-gradient-to-t" : "bg-gradient-to-r";
  return dark
    ? `${dir} from-white/90 via-white/45 to-transparent`
    : `${dir} from-black/85 via-black/35 to-transparent`;
}
