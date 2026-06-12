import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeDisplayPrice, computeEpicDisplayPrice, getSettings } from "@/lib/pricing";
import { semanticSearchIds } from "@/lib/semantic-search";
import { getOpenAI, isOpenAIConfigured } from "@/lib/openai";
import { expandAliases } from "@/lib/search-aliases";
import { SITE_NAME } from "@/lib/site";
import { STREAMING_SERVICE_META, type StreamingService } from "@/lib/streamingCart";
import { getAiKnowledge } from "@/lib/aiKnowledge";
import { getCurrentUser } from "@/lib/auth";
import { consumeRateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Client üçün yüngül auth yoxlaması — panel açılanda giriş tələbini göstərmək. */
export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({ authed: Boolean(user) });
}

/**
 * "AI-dan soruş" köməkçisi. Saytın oyun kataloqu üzərində qurulub: istifadəçinin
 * sualına ən uyğun məhsullar semantik axtarışla tapılır, qiymətlərlə birlikdə
 * kontekst kimi modelə ötürülür. Model YALNIZ bu kontekst əsasında, yalnız
 * saytdakı məhsullara dair cavab verir və tövsiyə etdiyi məhsulların
 * `productId`-lərini qaytarır — server bunları tam kart məlumatına çevirir, ona
 * görə UI hər məhsulu şəkli, qiyməti və "Səbətə əlavə et" düyməsi ilə göstərə
 * bilir.
 *
 * Cavab: { reply: string, products: ProductCard[] }
 */

// Kontekstə neçə məhsul namizədi daxil edilir.
const CONTEXT_PRODUCTS = 14;
// Köməkçinin cavabında göstərilə biləcək maksimum kart sayı.
const MAX_CARDS = 6;
// Söhbət tarixçəsindən neçə əvvəlki mesaj saxlanılır.
const MAX_HISTORY = 8;
const MAX_MESSAGE_LEN = 1000;
// Chat modeli — env ilə dəyişdirilə bilər (məs. AI_CHAT_MODEL=gpt-4o). Default
// gpt-4o-mini: ucuz və sürətli. Daha keyfiyyətli cavab üçün gpt-4o qoyula bilər.
const CHAT_MODEL = process.env.AI_CHAT_MODEL || "gpt-4o-mini";
// Rate-limit: hər istifadəçi saatda ən çox bu qədər sual verə bilər.
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_SECONDS = 3600;

type ChatMessage = { role: "user" | "assistant"; content: string };

type ProductCard = {
  id: string;
  productId: string;
  title: string;
  imageUrl: string | null;
  finalAzn: number;
  originalAzn: number | null;
  discountPct: number | null;
  productType: string;
  store: string;
};

/** Abunə / xidmət kartı (ServiceProduct) — chat-da qiymət + səbətə əlavə üçün. */
type ServiceCard = {
  id: string;
  title: string;
  imageUrl: string | null;
  finalAzn: number;
  originalAzn: number | null;
  discountPct: number | null;
  /** Cart productType: STREAMING | PS_PLUS | EA_PLAY | PUBG_UC | ... */
  productType: string;
  /** Səhifə linki (məs. /streaming/prime). */
  link: string | null;
  /** Birbaşa səbətə əlavə oluna bilərmi? Gmail/şifrə tələb edənlər (YouTube,
   *  music, hesab-açma) üçün false → kart "Bax" linki göstərir. */
  addable: boolean;
};

function isChatMessage(v: unknown): v is ChatMessage {
  if (!v || typeof v !== "object") return false;
  const m = v as Record<string, unknown>;
  return (
    (m.role === "user" || m.role === "assistant") &&
    typeof m.content === "string"
  );
}

export async function POST(req: Request) {
  // Giriş tələbi — köməkçidən yalnız daxil olmuş müştərilər istifadə edə bilər.
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Bu funksiyadan istifadə üçün daxil olmalısınız.", authRequired: true },
      { status: 401 }
    );
  }

  if (!isOpenAIConfigured()) {
    return NextResponse.json(
      { error: "AI köməkçisi hazırda əlçatan deyil." },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Yanlış sorğu." }, { status: 400 });
  }

  const rawMessages = (body as { messages?: unknown })?.messages;
  if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
    return NextResponse.json({ error: "Mesaj boşdur." }, { status: 400 });
  }

  const messages: ChatMessage[] = rawMessages
    .filter(isChatMessage)
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_LEN) }));

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser || lastUser.content.trim().length < 2) {
    return NextResponse.json({ error: "Sual çox qısadır." }, { status: 400 });
  }

  // Rate-limit — hər istifadəçi saatda ən çox RATE_LIMIT_MAX sual verə bilər.
  const rl = await consumeRateLimit({
    key: `ai-chat:user:${user.id}`,
    scope: "ai-chat",
    windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
    max: RATE_LIMIT_MAX,
  });
  if (!rl.ok) {
    return NextResponse.json(
      {
        error: `Saatda ${RATE_LIMIT_MAX} suala qədər verə bilərsiniz. Təxminən ${rl.retryAfterMinutes} dəqiqə sonra yenidən cəhd edin.`,
        rateLimited: true,
        retryAfterSeconds: rl.retryAfterSeconds,
      },
      { status: 429 }
    );
  }

  // Retrieval mətni — son bir neçə istifadəçi mesajını birləşdir. Bu vacibdir:
  // "gta v neçəyədir?" → AI "PC yoxsa PlayStation?" soruşur → istifadəçi
  // "playstation" yazır. Yalnız son mesajı götürsək axtarış "playstation"-ı
  // axtarar və oyunu itirər; ona görə oyun adı olan əvvəlki mesajı da qoşuruq.
  const recentUserText = messages
    .filter((m) => m.role === "user")
    .slice(-3)
    .map((m) => m.content)
    .join(" ");

  // Alias genişlənməsi (geta→GTA, futbol→EA Sports FC və s.) eyni kanalda tətbiq olunur.
  const query = expandAliases(recentUserText).variants.join(" ");
  const [
    { context, cards },
    streamingContext,
    { context: subContext, cards: serviceCards },
    knowledge,
  ] = await Promise.all([
    buildCatalogContext(query),
    // "Off Campus haradan baxa bilərəm?" kimi suallar üçün — film/serialın
    // hansı platformada olduğunu real kataloqdan tap (model uydurmasın).
    buildStreamingCatalogContext(recentUserText),
    // Abunə/xidmət qiymətləri + kartları (Prime Video, PS Plus, EA Play və s.).
    buildSubscriptionsContext(),
    // Admin paneldən idarə olunan sabit bilik bazası.
    getAiKnowledge(),
  ]);

  const systemPrompt = buildSystemPrompt(
    context,
    streamingContext,
    subContext,
    knowledge
  );

  let parsed: { reply: string; productIds: string[]; serviceIds: string[] };
  try {
    const client = getOpenAI();
    const res = await client.chat.completions.create({
      model: CHAT_MODEL,
      temperature: 0.3,
      max_tokens: 400,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    });
    const raw = res.choices[0]?.message?.content ?? "{}";
    const obj = JSON.parse(raw) as {
      reply?: unknown;
      productIds?: unknown;
      serviceIds?: unknown;
    };
    parsed = {
      reply: typeof obj.reply === "string" ? obj.reply : "",
      productIds: Array.isArray(obj.productIds)
        ? obj.productIds.filter((x): x is string => typeof x === "string")
        : [],
      serviceIds: Array.isArray(obj.serviceIds)
        ? obj.serviceIds.filter((x): x is string => typeof x === "string")
        : [],
    };
  } catch (e) {
    console.error("ai/chat: OpenAI çağırışı uğursuz oldu", e);
    return NextResponse.json(
      { error: "AI köməkçisi cavab verə bilmədi." },
      { status: 502 }
    );
  }

  // Model yalnız kontekstdəki productId-ləri qaytarmalıdır — uydurma id-ləri at,
  // sırasını qoru, təkrarları sil, maksimum kart sayını tətbiq et.
  const seen = new Set<string>();
  const products: ProductCard[] = [];
  for (const pid of parsed.productIds) {
    if (seen.has(pid)) continue;
    const card = cards.get(pid);
    if (!card) continue;
    seen.add(pid);
    products.push(card);
    if (products.length >= MAX_CARDS) break;
  }

  // Abunə/xidmət kartları — model yalnız kontekstdəki serviceId-ləri qaytarmalıdır.
  const seenSvc = new Set<string>();
  const services: ServiceCard[] = [];
  for (const sid of parsed.serviceIds) {
    if (seenSvc.has(sid)) continue;
    const card = serviceCards.get(sid);
    if (!card) continue;
    seenSvc.add(sid);
    services.push(card);
    if (services.length >= MAX_CARDS) break;
  }

  // Fallback: model serviceId qaytarmasa belə (gpt-4o-mini alış niyyətində bunu
  // tez-tez buraxır), istifadəçinin mətni abunə adına uyğun gəlirsə uyğun
  // kartları özümüz tapıb göstəririk ("netflix 1 ay alıram", "səbətə əlavə et").
  if (services.length === 0) {
    for (const card of matchSubscriptionCards(recentUserText, serviceCards)) {
      if (seenSvc.has(card.id)) continue;
      seenSvc.add(card.id);
      services.push(card);
      if (services.length >= MAX_CARDS) break;
    }
  }

  const reply =
    parsed.reply.trim() ||
    (products.length > 0 || services.length > 0
      ? "Bu nəticələri tapdım:"
      : "Üzr istəyirəm, bu barədə uyğun məhsul tapa bilmədim.");

  // Söhbəti logla (admin paneldə "hansı müştəri nə soruşub" üçün). Cavabı
  // gecikdirməsin və loglama xətası sorğunu pozmasın deyə fire-and-forget.
  prisma.aiChatLog
    .create({
      data: {
        userId: user.id,
        question: lastUser.content,
        reply,
        productCount: products.length + services.length,
      },
    })
    .catch((e) => console.error("ai/chat: log yazılmadı", e));

  return NextResponse.json({ reply, products, services });
}

/**
 * Epic Games kataloqu üçün açar söz (title) axtarışı. Epic oyunlarında embedding
 * olmadığından semantik axtarış işləmir — ona görə alias-genişlənmiş sorğunun
 * sözlərini başlıqla ILIKE üzrə uyğunlaşdırırıq. Əvvəlcə tam ifadə, sonra ayrı
 * sözlər; ən çox söz uyğunlaşan başlıqlar önə çəkilir.
 */
async function epicKeywordIds(query: string, k: number): Promise<string[]> {
  const cleaned = query.toLowerCase().replace(/[?!.,;:"'()]/g, " ").trim();
  const tokens = [...new Set(cleaned.split(/\s+/).filter((t) => t.length >= 3))];
  if (tokens.length === 0) return [];

  try {
    const rows = await prisma.game.findMany({
      where: {
        store: "EPIC",
        isActive: true,
        productType: "GAME",
        OR: tokens.map((t) => ({
          title: { contains: t, mode: "insensitive" as const },
        })),
      },
      select: { id: true, title: true },
      take: 60,
    });
    if (rows.length === 0) return [];

    // Ən çox token uyğunlaşan başlıqları önə çək (sadə relevans skoru).
    const scored = rows.map((r) => {
      const lower = r.title.toLowerCase();
      const score = tokens.reduce((n, t) => (lower.includes(t) ? n + 1 : n), 0);
      return { id: r.id, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, k).map((s) => s.id);
  } catch (e) {
    console.error("ai/chat: epicKeywordIds uğursuz", e);
    return [];
  }
}

/**
 * Sualı kataloqun ən uyğun məhsulları ilə əsaslandırır. Modelə veriləcək mətn
 * kontekstini və `productId → kart məlumatı` xəritəsini birgə qaytarır (kart
 * datasını yenidən sorğulamamaq üçün).
 */
async function buildCatalogContext(
  query: string
): Promise<{ context: string; cards: Map<string, ProductCard> }> {
  const empty = { context: "", cards: new Map<string, ProductCard>() };

  // Hər iki mağazadan ayrıca axtar — PlayStation (PS) və Kompüter (Epic Games).
  // PS oyunları embed olunub → semantik axtarış. Epic oyunlarında embedding
  // yoxdur → açar söz (title) axtarışı. Model istifadəçinin seçdiyi cihaza görə
  // uyğun məhsulları göstərir.
  const [psHits, epicIds] = await Promise.all([
    semanticSearchIds(query, CONTEXT_PRODUCTS, {
      store: "PS",
      minScore: 0.3,
      relFraction: 0.7,
    }).catch((e) => {
      console.error("ai/chat: PS semanticSearchIds uğursuz", e);
      return [] as Awaited<ReturnType<typeof semanticSearchIds>>;
    }),
    epicKeywordIds(query, CONTEXT_PRODUCTS),
  ]);

  // PS əvvəl, sonra Epic — sıranı qoru, təkrarları sil.
  const orderedIds = [...psHits.map((h) => h.id), ...epicIds];
  if (orderedIds.length === 0) return empty;

  const [games, settings] = await Promise.all([
    prisma.game.findMany({ where: { id: { in: orderedIds }, isActive: true } }),
    getSettings(),
  ]);
  const byId = new Map(games.map((g) => [g.id, g]));

  const typeLabel: Record<string, string> = {
    GAME: "Oyun",
    ADDON: "Əlavə (DLC)",
    CURRENCY: "Daxili valyuta / kart",
    OTHER: "Digər",
  };

  const cards = new Map<string, ProductCard>();
  const lines: string[] = [];
  const seen = new Set<string>();

  for (const id of orderedIds) {
    if (seen.has(id)) continue;
    const g = byId.get(id);
    if (!g) continue;
    seen.add(id);

    const isEpic = g.store === "EPIC";
    // Epic pricing mövqe əsaslıdır (computeEpicDisplayPrice), PS isə marja əsaslı.
    const price = isEpic
      ? computeEpicDisplayPrice(g, settings)
      : computeDisplayPrice(g, settings);

    cards.set(g.productId, {
      id: g.id,
      productId: g.productId,
      title: g.title,
      imageUrl: g.imageUrl,
      finalAzn: price.finalAzn,
      originalAzn: price.discountPct ? price.originalAzn : null,
      discountPct: price.discountPct,
      productType: g.productType,
      store: g.store,
    });

    const priceText =
      price.discountPct && price.originalAzn
        ? `${price.finalAzn} AZN (əvvəl ${price.originalAzn} AZN, -${price.discountPct}%)`
        : `${price.finalAzn} AZN`;
    // Cihaz etiketi — model bunun əsasında PC/PlayStation seçimini edir.
    const deviceLabel = isEpic
      ? "Cihaz: Kompüter (Epic Games / PC)"
      : `Cihaz: PlayStation${g.platform ? ` (${g.platform})` : ""}`;
    lines.push(
      `productId: ${g.productId} | ${g.title} | ${deviceLabel} | ${typeLabel[g.productType] ?? g.productType} | ${priceText}`
    );
  }

  return { context: lines.join("\n"), cards };
}

// Scraped kataloqun platform kodları → satılan abunə (label + slug).
const PLATFORM_TO_SERVICE: Record<string, { label: string; slug: string }> = {
  NETFLIX: { label: "Netflix", slug: "netflix" },
  HBOMAX: { label: "HBO Max", slug: "hbo-max" },
  PRIME: { label: "Prime Video", slug: "prime" },
  GAIN: { label: "Gain", slug: "gain" },
};

// "Haradan baxa bilərəm?" tipli suallardan film/serial adını ayırmaq üçün
// atılan ümumi söz/sual kəlmələri (AZ/TR/EN).
const TITLE_STOPWORDS = new Set([
  "haradan", "harada", "hara", "baxa", "baxmaq", "bax", "bilerem", "bilərəm",
  "bilirem", "bilirəm", "izleye", "izləyə", "izlemek", "izləmək", "izle", "izlə",
  "var", "varmi", "varmı", "hansi", "hansı", "platformada", "platforma",
  "filmi", "film", "filmini", "serial", "seriali", "serialı", "nece", "necə",
  "men", "mən", "mene", "mənə", "ucun", "üçün", "ve", "və", "da", "de", "də",
  "the", "watch", "where", "can", "how", "what", "is", "on", "a", "an", "to",
  "i", "my", "of", "in",
]);

/**
 * "Off Campus haradan baxa bilərəm?" kimi suallar üçün streaming kataloqunda
 * (StreamingTitle + ContentAvailability) film/serialı tapır və hansı
 * platformalarda mövcud olduğunu qaytarır. Tapılmazsa boş string — model
 * platformanı UYDURMAMALI, kataloqa yönləndirməlidir.
 */
async function buildStreamingCatalogContext(userText: string): Promise<string> {
  const cleaned = userText
    .toLowerCase()
    .replace(/[?!.,;:"'()]/g, " ")
    .trim();
  const tokens = cleaned
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !TITLE_STOPWORDS.has(t));
  if (tokens.length === 0) return "";

  // Söz sırasını qoruyub stopword-ləri ataraq ehtimal olunan başlıq ifadəsi
  // ("off campus"). Əvvəlcə tam ifadəni, sonra ayrı sözləri sınayırıq.
  const phrase = tokens.join(" ");

  let rows;
  try {
    rows = await prisma.streamingTitle.findMany({
      where: {
        isActive: true,
        azAvailable: true,
        availabilities: { some: { isAvailable: true } },
        OR: [
          { title: { contains: phrase, mode: "insensitive" } },
          ...tokens.map((t) => ({
            title: { contains: t, mode: "insensitive" as const },
          })),
        ],
      },
      select: {
        title: true,
        year: true,
        kind: true,
        availabilities: {
          where: { isAvailable: true },
          select: { platform: true },
        },
      },
      // Tam ifadə uyğunluğu ehtimalı yüksək olanları önə çəkmək çətindir (Prisma
      // sıralaya bilmir), ona görə ağ siyahını kiçik saxlayıb sıralamağı modelə
      // buraxırıq.
      take: 10,
      orderBy: [{ tmdbPopularity: "desc" }],
    });
  } catch (e) {
    console.error("ai/chat: streaming kataloq sorğusu uğursuz", e);
    return "";
  }

  if (rows.length === 0) return "";

  const lines: string[] = [];
  for (const r of rows) {
    const services = new Map<string, { label: string; slug: string }>();
    for (const av of r.availabilities) {
      const svc = PLATFORM_TO_SERVICE[av.platform];
      if (svc) services.set(svc.slug, svc);
    }
    if (services.size === 0) continue;
    const platformText = [...services.values()]
      .map((s) => `${s.label} (/streaming/${s.slug})`)
      .join(", ");
    const kindLabel = r.kind === "SERIES" ? "Serial" : "Film";
    const yearText = r.year ? ` (${r.year})` : "";
    lines.push(`${kindLabel}: ${r.title}${yearText} | Platformalar: ${platformText}`);
  }

  return lines.join("\n");
}

/**
 * Abunə və xidmət məhsullarının (ServiceProduct) QİYMƏTLƏRİ — Prime Video,
 * Netflix, HBO Max, Gain, PS Plus, EA Play, PUBG UC, hədiyyə kartları və s.
 * Bu kontekst olmadan AI abunə qiymətlərini bilmir və "baxa bilmirəm" kimi
 * yayınır. Buradakı qiymətlər real DB-dən gəlir.
 */
async function buildSubscriptionsContext(): Promise<{
  context: string;
  cards: Map<string, ServiceCard>;
}> {
  const empty = { context: "", cards: new Map<string, ServiceCard>() };
  try {
    const rows = await prisma.serviceProduct.findMany({
      where: { isActive: true },
      orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { priceAznCents: "asc" }],
      select: {
        id: true,
        title: true,
        type: true,
        priceAznCents: true,
        imageUrl: true,
        metadata: true,
      },
      take: 150,
    });
    if (rows.length === 0) return empty;

    const cards = new Map<string, ServiceCard>();
    const lines: string[] = [];

    for (const r of rows) {
      const m = (r.metadata ?? {}) as Record<string, unknown>;
      const finalAzn = r.priceAznCents / 100;
      const opc = Number(m.originalPriceAznCents);
      const originalAzn =
        Number.isFinite(opc) && opc > r.priceAznCents ? opc / 100 : null;
      const discountPct = originalAzn
        ? Math.round(((originalAzn - finalAzn) / originalAzn) * 100)
        : null;
      const link = serviceProductLink(r.type, m);
      const addable = isServiceAddable(r.type, r.title);

      cards.set(r.id, {
        id: r.id,
        title: r.title,
        imageUrl: r.imageUrl,
        finalAzn,
        originalAzn,
        discountPct,
        productType: r.type,
        link,
        addable,
      });

      lines.push(
        `serviceId: ${r.id} | ${r.title} | ${finalAzn.toFixed(2)} AZN${
          link ? ` | Səhifə: ${link}` : ""
        }`
      );
    }

    return { context: lines.join("\n"), cards };
  } catch (e) {
    console.error("ai/chat: abunə konteksti uğursuz", e);
    return empty;
  }
}

/**
 * İstifadəçinin mətnini abunə/xidmət kartlarının başlığı ilə uyğunlaşdırır.
 * Hər kartın başlıq sözləri (≥3 hərf) mətndə varsa, kart uyğun sayılır — belə
 * ki "netflix 1 ay alıram" → bütün Netflix planları, "prime video" → Prime
 * planları. Model serviceId qaytarmayanda fallback kimi işlədilir.
 */
function matchSubscriptionCards(
  text: string,
  cards: Map<string, ServiceCard>
): ServiceCard[] {
  const haystack = text.toLowerCase();
  const out: ServiceCard[] = [];
  for (const card of cards.values()) {
    const words = card.title
      .toLowerCase()
      .split(/[^a-zəğıöşçü0-9]+/i)
      .filter((w) => w.length >= 3 && !/^\d+$/.test(w));
    if (words.some((w) => haystack.includes(w))) out.push(card);
  }
  return out;
}

/** Birbaşa səbətə əlavə oluna bilərmi? Gmail/şifrə və ya hesab məlumatı tələb
 *  edən tiplər (YouTube/music, hesab-açma) checkout-da bloklanır — onlar üçün
 *  kart "Bax" linki göstərir, birbaşa əlavə yox. */
function isServiceAddable(type: string, title: string): boolean {
  if (
    type === "ACCOUNT_CREATION" ||
    type === "EPIC_ACCOUNT_CREATION" ||
    type === "PLATFORM"
  ) {
    return false;
  }
  if (type === "STREAMING" && title.toLowerCase().includes("youtube")) {
    return false;
  }
  return true;
}

function serviceProductLink(type: string, m: Record<string, unknown>): string | null {
  const svcCode = String(m.service ?? m.musicBrand ?? "").toUpperCase();
  const meta = svcCode
    ? STREAMING_SERVICE_META[svcCode as StreamingService]
    : undefined;
  switch (type) {
    case "STREAMING":
      return meta ? `/streaming/${meta.slug}` : "/streaming";
    case "PLATFORM":
      return meta ? `/music/${meta.slug}` : "/music";
    case "PS_PLUS":
      return "/ps-plus";
    case "EA_PLAY":
      return "/ea-play";
    case "PUBG_UC":
      return "/pubg-uc";
    case "HONSELL_GIFT_CARD":
      return "/hediyye-kartlari/honsell";
    case "TRY_BALANCE":
      return "/hediyye-kartlari";
    case "EPIC_ACCOUNT_CREATION":
      return "/hesab-acma";
    default:
      return null;
  }
}

function buildSystemPrompt(
  context: string,
  streamingContext: string,
  subscriptions: string,
  knowledge: string
): string {
  const catalog = context
    ? `Sualla əlaqəli OYUNLAR (kart kimi göstəriləcək — yalnız bunların productId-lərini işlət):\n${context}`
    : "Bu sualla əlaqəli oyun kataloqunda nəticə tapılmadı.";

  return [
    `Sən ${SITE_NAME} saytının köməkçisisən. Azərbaycanda PlayStation oyunları,`,
    "PS Plus, streaming abunəlikləri, hədiyyə kartları və PSN hesab xidmətləri",
    "satan bir saytdır.",
    "",
    "Cavabını HƏMİŞƏ aşağıdakı JSON formatında ver:",
    '{"reply": "qısa mətn", "productIds": ["oyun id-ləri"], "serviceIds": ["abunə/xidmət id-ləri"]}',
    "",
    "QAYDALAR:",
    "1. Yalnız bu sayta (aşağıdakı bölmələrə və oyun kataloquna) aid suallara cavab",
    "   ver. Saytdakı istənilən bölmə/xidmət barədə soruşula bilər.",
    "2. `productIds` siyahısı YALNIZ oyun kataloqu kontekstindəki productId-lər üçündür",
    "   (kart kimi göstərilir). Streaming, PS Plus, hədiyyə kartı kimi xidmətlərin",
    "   kartı YOXDUR — onları `reply` mətnində izah et və müvafiq səhifə linkini ver",
    "   (məs. /streaming/katalog). Heç vaxt productId, oyun və ya qiymət uydurma.",
    "3. CİHAZ SUALI: Oyun və ya oyun qiyməti soruşulanda, istifadəçi cihazı",
    "   bildirməyibsə, ƏVVƏLCƏ bunu soruş: \"Bu oyunu kompüter (Epic Games) üçün,",
    "   yoxsa PlayStation üçün axtarırsan?\" — bu halda heç bir kart göstərmə",
    "   (`productIds` boş qalsın).",
    "4. İstifadəçi cihazı bildirəndə yalnız uyğun mağazanın məhsullarını seç:",
    "   kompüter/komputer/pc/epic → yalnız 'Cihaz: Kompüter (Epic Games / PC)' olan",
    "   məhsullar; playstation/ps/ps4/ps5/konsol → yalnız 'Cihaz: PlayStation' olan",
    "   məhsullar. Söhbətdə cihaz artıq deyilibsə təkrar soruşma, birbaşa göstər.",
    "5. Oyun tövsiyə edəndə ən uyğun məhsulları seç (ən çox 6 ədəd), ən uyğunu birinci.",
    "   Oyun kartlarının qiymət/linkini `reply` mətnində TƏKRAR SADALAMA — kart kimi",
    "   görünür. Sadəcə qısa giriş yaz (məs. \"GTA üzrə bu oyunları tapdım:\").",
    "6. Abunə/xidmət sualına (Netflix, Prime Video, HBO Max, Gain, PS Plus, EA Play,",
    "   PUBG UC, hədiyyə kartı və s.): aşağıdakı ABUNƏ VƏ XİDMƏT QİYMƏTLƏRİ blokundan",
    "   uyğun paketlərin `serviceId`-lərini `serviceIds` siyahısına qoy (ən çox 6) —",
    "   onlar səbətə əlavə düyməsi olan KART kimi göstərilir. \"Daxil ol və bax\" və",
    "   ya \"baxa bilmirəm\" KİMİ CAVAB VERMƏ — qiymətlər sənə verilib. `reply` qısa",
    "   giriş olsun (məs. \"Prime Video abunəlikləri:\"); qiymətləri mətndə TƏKRAR",
    "   SADALAMA, kartlar göstərir. Yalnız serviceId-lər kontekstdəkindən olsun.",
    "6a. SƏBƏT / ALIŞ NİYYƏTİ: İstifadəçi konkret məhsulu/planı almaq və ya səbətə",
    "   əlavə etmək istəsə (\"almaq istəyirəm\", \"2 aylıq alıram\", \"səbətə əlavə et\",",
    "   \"necə alıram\" və s.) — həmin KONKRET paketin `serviceId`-ini (oyundursa",
    "   `productId`-ini) MÜTLƏQ qaytar ki, onun kartı görünsün. Kartın üstündə",
    "   **Səbətə əlavə et** düyməsi var — istifadəçiyə həmin düyməni basmağı təklif et.",
    "   ƏSLA \"kömək edə bilmirəm\" və ya \"/cart səhifəsinə get\" DEMƏ — səbətə əlavə",
    "   kartdakı düymə ilə olur. Söhbətdə müddət/plan əvvəl deyilibsə (məs. \"2 ay\"),",
    "   yalnız həmin planın kartını göstər.",
    "7. \"Filan film/serial haradan baxılır?\" sualına YALNIZ aşağıdakı STREAMING",
    "   KATALOQU kontekstindəki məlumatla cavab ver. Bir başlığın hansı platformada",
    "   olduğunu ƏSLA TƏXMİN ETMƏ. Kontekstdə həmin başlıq yoxdursa, onun bizdə",
    "   olub-olmadığını dəqiq bilmədiyini de və /streaming/katalog səhifəsindən",
    "   axtarmağı təklif et.",
    "8. `reply` qısa, səmimi və Azərbaycan dilində olsun. Oxunaqlı format işlət:",
    "   sadalama lazım olanda hər bəndi yeni sətirdə \"- \" ilə bullet kimi yaz",
    "   (nömrə yox), açar sözləri **qalın** ver, yerinə düşəndə 1 emoji işlət.",
    "   Mətni qısa saxla (2-4 sətir/bənd), divar kimi uzun abzas yazma.",
    "9. MÖVCUD OLMAYAN MƏHSUL: Müştəri bizim satdığımız kateqoriyaya aid (oyun,",
    "   abunəlik, hədiyyə kartı, oyun valyutası və s.) amma kataloqumuzda/bilik",
    "   bazamızda OLMAYAN bir məhsul soruşsa (məs. Spotify abunəsi, kataloqda",
    "   olmayan bir oyun) — onu kobud şəkildə rədd ETMƏ. Kibarca de ki, həmin",
    "   məhsul HAZIRDA bizdə satışda yoxdur, və istəyirsə bu məhsulun satışda",
    "   olmasını bizə bildirə bilər (sorğu/istək kimi). Qiymət və ya link uydurma.",
    "10. TAMAMİLƏ ƏLAQƏSİZ suallar (ümumi söhbət, kod yazmaq, hava, xəbər, riyaziyyat",
    "   və s.) verilərsə, kibarca rədd et və yalnız Honsell mağazası ilə bağlı",
    "   (oyun, abunəlik, hədiyyə kartı, xidmətlər) kömək edə biləcəyini bildir.",
    "11. Bilik bazasında və ya kataloqda olmayan məlumatı uydurma.",
    "12. DİL: Cavabı düzgün, təbii və qrammatik Azərbaycan dilində yaz. \"Bağışlayıram\"",
    "   YAZMA — bu səhvdir; üzr istəyəndə \"Üzr istəyirəm\" və ya \"Bağışlayın\" işlət.",
    "",
    knowledge,
    "",
    subscriptions
      ? `ABUNƏ VƏ XİDMƏT QİYMƏTLƏRİ (real, satışda olan paketlər — qiymət soruşulanda bunları işlət):\n${subscriptions}`
      : "ABUNƏ VƏ XİDMƏT QİYMƏTLƏRİ: hazırda aktiv paket tapılmadı.",
    "",
    streamingContext
      ? `STREAMING KATALOQU (sualla uyğun film/seriallar və mövcud platformaları):\n${streamingContext}`
      : "STREAMING KATALOQU: sualla uyğun film/serial tapılmadı (platformanı uydurma).",
    "",
    catalog,
  ].join("\n");
}
