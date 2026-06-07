/**
 * AI bilik bazasının CLIENT-SAFE hissəsi — sırf sabitlər və köməkçilər, heç bir
 * server (prisma) asılılığı yoxdur. Həm admin client komponenti, həm də server
 * (lib/aiKnowledge.ts) buradan istifadə edir ki, prisma client bundle-a düşməsin.
 */

export type AiKnowledgeCategory = {
  key: string;
  label: string;
};

export const AI_KNOWLEDGE_CATEGORIES: AiKnowledgeCategory[] = [
  { key: "GENERAL", label: "Ümumi" },
  { key: "PLAYSTATION", label: "PlayStation" },
  { key: "STREAMING", label: "Streaming" },
  { key: "GIFT_CARDS", label: "Hədiyyə kartları" },
  { key: "SERVICES", label: "Xidmətlər" },
  { key: "OTHER", label: "Digər" },
];

export function isValidAiKnowledgeCategory(c: string): boolean {
  return AI_KNOWLEDGE_CATEGORIES.some((x) => x.key === c);
}

export function aiKnowledgeCategoryLabel(key: string): string {
  return AI_KNOWLEDGE_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

/**
 * Cədvəl ilk dəfə yaranan kimi doldurulan standart bilik girişləri. Admin
 * sonradan paneldən redaktə/əlavə/silə bilər.
 */
export const DEFAULT_AI_KNOWLEDGE: Array<{
  title: string;
  content: string;
  category: string;
  sortOrder: number;
}> = [
  {
    title: "Sayt haqqında",
    category: "GENERAL",
    sortOrder: 0,
    content:
      "Honsell PS Store — Azərbaycanda PlayStation oyunları, PS Plus, streaming abunəlikləri, hədiyyə kartları və PSN hesab açma xidmətləri satan saytdır. Çatdırılma adətən anında/qısa müddətdə, ödəniş etibarlıdır.",
  },
  {
    title: "Oyunlar və PS Plus",
    category: "PLAYSTATION",
    sortOrder: 10,
    content:
      "PS4 və PS5 oyunları: /oyunlar. Endirimli oyunlar: /endirimler. PS Plus abunəlikləri (Essential, Extra, Deluxe): /ps-plus. EA Play: /ea-play. Türkiyə PSN hesabı açma: /hesab-acma. Epic Games oyunları: /epic-games. Oyun valyutaları/top-up: PUBG UC /pubg-uc, Point Blank /point-blank. (Konkret oyun və qiymətlər dinamik kataloqdan gəlir.)",
  },
  {
    title: "Streaming abunəlikləri",
    category: "STREAMING",
    sortOrder: 20,
    content:
      "Saytda satılan streaming abunəlikləri (ödənişdən sonra giriş email ilə gəlir): Netflix /streaming/netflix, HBO Max /streaming/hbo-max, Prime Video /streaming/prime, Gain /streaming/gain, YouTube Premium /music/youtube.",
  },
  {
    title: "Streaming kataloqu (izləmə bələdçisi)",
    category: "STREAMING",
    sortOrder: 30,
    content:
      "Hansı film/serialın hansı platformada (Netflix, HBO Max, Prime Video, Gain) olduğunu göstərən katalog: /streaming/katalog. Filmlər: /streaming/filmler, Seriallar: /streaming/seriallar, İcmallar: /streaming/icmallar. Bir başlığın platformasını yalnız kataloq datası təsdiqləyirsə de — təxmin etmə.",
  },
  {
    title: "Hədiyyə kartları",
    category: "GIFT_CARDS",
    sortOrder: 40,
    content:
      "TRY Wallet kartları, PSN top-up və PlayStation gift card: /hediyye-kartlari. Honsell hədiyyə kartı: /hediyye-kartlari/honsell. Hədiyyə kart aktivləşdirmə: /profile/hediyye-kart.",
  },
  {
    title: "Digər bölmələr",
    category: "OTHER",
    sortOrder: 50,
    content:
      "Referal proqramı (Qazan): /qazan. Bələdçilər: /bilmeli-olduglarin. Müştəri rəyləri: /reyler. Haqqımızda: /haqqimizda. Səbət: /cart. Hesabım: /profile.",
  },
];

/**
 * Statik fallback mətn — DB əlçatmaz olduqda chat sistem prompt-unda istifadə
 * olunur. Default girişlərdən qurulur ki, hər zaman sinxron qalsın.
 */
export const SITE_KNOWLEDGE = [
  "SAYTIN BİLİK BAZASI:",
  "",
  ...DEFAULT_AI_KNOWLEDGE.map((e) => `${e.title}: ${e.content}`),
].join("\n");
