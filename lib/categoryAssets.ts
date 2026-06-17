export type ProductCategoryDefinition = {
  key: string;
  href: string;
  label: string;
  description: string;
  sortOrder: number;
};

export type ProductCategoryNavAsset = Omit<ProductCategoryDefinition, "description"> & {
  description: string | null;
  imageUrl: string | null;
  isActive: boolean;
};

export const PRODUCT_CATEGORY_DEFINITIONS: ProductCategoryDefinition[] = [
  {
    key: "PLAYSTATION_GAMES",
    href: "/oyunlar",
    label: "PlayStation Oyunları",
    description: "PS4 və PS5 rəqəmsal oyunları",
    sortOrder: 0,
  },
  {
    key: "PS_PLUS",
    href: "/ps-plus",
    label: "PS Plus",
    description: "Essential, Extra və Deluxe paketləri",
    sortOrder: 1,
  },
  {
    key: "PS_TRY_GIFT_CARD",
    href: "/hediyye-kartlari",
    label: "PS TRY Gift Card",
    description: "Türkiyə PSN balans kartları",
    sortOrder: 2,
  },
  {
    key: "PSN_TURKEY_ACCOUNT",
    href: "/hesab-acma",
    label: "PSN Türkiyə Hesabı Açmaq",
    description: "Sənin üçün TR PSN hesabı",
    sortOrder: 3,
  },
  {
    key: "EPIC_GAMES",
    href: "/epic-games",
    label: "Epic Games Oyunları",
    description: "PC üçün Epic Games kataloqu",
    sortOrder: 4,
  },
  {
    key: "NETFLIX",
    href: "/streaming/netflix",
    label: "Netflix",
    description: "Film və serial abunəliyi",
    sortOrder: 5,
  },
  {
    key: "YOUTUBE_PREMIUM",
    href: "/music/youtube",
    label: "YouTube Premium",
    description: "Reklamsız video və musiqi",
    sortOrder: 6,
  },
  {
    key: "HBO_MAX",
    href: "/streaming/hbo-max",
    label: "HBO Max",
    description: "Premium film və serial arxivi",
    sortOrder: 7,
  },
  {
    key: "GAIN",
    href: "/streaming/gain",
    label: "Gain",
    description: "Yerli və xarici kontent",
    sortOrder: 8,
  },
  {
    key: "EA_PLAY",
    href: "/ea-play",
    label: "EA Play",
    description: "EA oyun kolleksiyası və sınaq",
    sortOrder: 9,
  },
  {
    key: "PUBG_UC",
    href: "/pubg-uc",
    label: "PUBG UC",
    description: "PUBG Mobile üçün UC paketləri",
    sortOrder: 10,
  },
  {
    key: "POINT_BLANK_TG",
    href: "/point-blank",
    label: "Point Blank TG",
    description: "Point Blank üçün TG paketləri",
    sortOrder: 11,
  },
  {
    key: "CHATGPT",
    href: "/ai/chatgpt",
    label: "ChatGPT",
    description: "ChatGPT paketləri",
    sortOrder: 12,
  },
  {
    key: "CLAUDE",
    href: "/ai/claude",
    label: "Claude",
    description: "Claude AI paketləri",
    sortOrder: 13,
  },
  {
    key: "LINKEDIN_PREMIUM",
    href: "/work/linkedin-premium",
    label: "LinkedIn Premium",
    description: "Karyera və biznes paketləri",
    sortOrder: 14,
  },
  {
    key: "HONSELL_GIFT_CARD",
    href: "/hediyye-kartlari/honsell",
    label: "Honsell Gift Card",
    description: "Honsell daxili hədiyyə balansı",
    sortOrder: 15,
  },
  {
    key: "MOVIE_SERIAL_CATALOG",
    href: "/streaming/katalog",
    label: "Film və Serial Kataloqu",
    description: "Nə harada var, tez tap",
    sortOrder: 16,
  },
  {
    key: "WEBSITE_SERVICE",
    href: "/xidmetler/website",
    label: "Website Hazırlanması",
    description: "Biznes üçün satış yönümlü sayt",
    sortOrder: 17,
  },
];

export const PRODUCT_CATEGORY_KEYS = new Set(
  PRODUCT_CATEGORY_DEFINITIONS.map((item) => item.key),
);

export function isValidProductCategoryKey(key: string): boolean {
  return PRODUCT_CATEGORY_KEYS.has(key);
}

export function productCategoryDefaultsByKey(): Map<string, ProductCategoryDefinition> {
  return new Map(PRODUCT_CATEGORY_DEFINITIONS.map((item) => [item.key, item]));
}
