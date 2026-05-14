/**
 * Header axtarış modalında "Populyar axtarışlar" pillərinin idarəsi.
 * Admin paneldə qeyd olunan iconKey-lər burada bir yerdə təyin olunur ki,
 * həm admin form-u, həm public modal eyni siyahıdan istifadə etsin.
 */

export const SEARCH_SUGGESTION_ICON_KEYS = [
  "SEARCH",
  "GAMEPAD",
  "GIFT",
  "TV",
  "FILM",
  "SPARKLES",
  "TROPHY",
  "CROWN",
  "MUSIC",
  "BRAIN",
] as const;

export type SearchSuggestionIconKey = (typeof SEARCH_SUGGESTION_ICON_KEYS)[number];

export const SEARCH_SUGGESTION_ICON_LABEL: Record<SearchSuggestionIconKey, string> = {
  SEARCH: "Axtarış",
  GAMEPAD: "Oyun",
  GIFT: "Hədiyyə kartı",
  TV: "Streaming",
  FILM: "Film / Serial",
  SPARKLES: "Trend",
  TROPHY: "Populyar",
  CROWN: "Premium",
  MUSIC: "Musiqi",
  BRAIN: "Süni intellekt",
};

export type SearchSuggestionDto = {
  id: string;
  label: string;
  iconKey: SearchSuggestionIconKey;
};

/**
 * NavSearch modal-ı boşaltmamaq üçün API heç nə qaytarmasa istifadə olunan
 * default siyahı. Admin paneldə bir element əlavə olunan kimi əvəzlənir.
 */
export const DEFAULT_SEARCH_SUGGESTIONS: SearchSuggestionDto[] = [
  { id: "default-1", label: "Spider-Man", iconKey: "GAMEPAD" },
  { id: "default-2", label: "PS Plus", iconKey: "GIFT" },
  { id: "default-3", label: "Netflix", iconKey: "TV" },
  { id: "default-4", label: "FIFA", iconKey: "GAMEPAD" },
  { id: "default-5", label: "Hogwarts", iconKey: "GAMEPAD" },
  { id: "default-6", label: "Stranger Things", iconKey: "FILM" },
];
