/**
 * PS Store "concept" → satıla bilən SKU çevirməsi.
 *
 * PS Store-un kateqoriya hub-ları oyunları **concept** kimi qaytarır (id sırf
 * rəqəm: `230079`, `10002694`), axtarış səhifəsi isə **SKU** kimi
 * (`EP9000-PPSA15508_00-THELASTOFUSPART2`). Skreyper hər ikisini eyni `Game`
 * cədvəlinə yazdığı üçün üç problem yaranırdı:
 *
 *  1. `/tr-tr/product/230079` **302 ilə ana səhifəyə** atır — concept yalnız
 *     `/tr-tr/concept/230079` ünvanında var. Ölü link həm məhsul səhifəsində,
 *     həm də admin sifariş panelində (fulfiller-in açdığı link) görünürdü.
 *  2. `platform` NULL qalır — `resolvePlatform` CUSA/PPSA koduna baxır, rəqəmli
 *     id-də isə belə kod yoxdur. Vitrində PS4/PS5 çipi olmayan kart məhz budur.
 *  3. **Ad concept-in, qiymət default SKU-nundur.** `Concept:230079` adı
 *     "The Last of Us™ Part II", `defaultProduct`-u isə Part II **Remastered**.
 *     Nəticədə vitrində "Part II −40%" kartı çıxırdı — halbuki o endirim
 *     Remastered-ə aiddir və Part II (PS4) endirimsizdir.
 *
 * Concept səhifəsinin apolloState-i `defaultProduct` referansını və həmin
 * SKU-nun **əsl adını** verir. Qiymət/media concept qrid sətrindən onsuz da
 * doğru gəlir (concept-in qiyməti = default SKU-nun qiyməti), ona görə bir
 * sorğu ilə sətri tam düzəltmək mümkündür.
 */

/** Rəqəmdən ibarət productId = PS Store concept id-si (SKU deyil). */
export function isConceptProductId(productId: string): boolean {
  return /^\d+$/.test(productId);
}

/**
 * PS Store məhsul linki. Concept id-si üçün `/concept/`, SKU üçün `/product/`.
 * ⚠️ Hər ikisini `/product/` ilə qurmaq concept sətirlərində ölü link verir.
 */
export function psStoreProductUrl(productId: string, locale = "tr-tr"): string {
  const path = isConceptProductId(productId) ? "concept" : "product";
  return `https://store.playstation.com/${locale}/${path}/${productId}`;
}

export type ConceptDefaultProduct = {
  /** Satıla bilən SKU id-si, məs. `EP9000-PPSA15508_00-THELASTOFUSPART2`. */
  productId: string;
  /** SKU-nun ÖZ adı (concept adı deyil) — `null` ola bilər. */
  title: string | null;
  /** Concept-in adı — yalnız diaqnostika/log üçün. */
  conceptName: string | null;
};

/**
 * Concept səhifəsinin HTML-indən default SKU-nu çıxarır. SAF funksiya —
 * şəbəkəyə çıxmır, ona görə fixture ilə test oluna bilir.
 *
 * apolloState açarları `Concept:<id>:<locale>` formasındadır; locale-i sərt
 * yazmırıq, prefiksə görə axtarırıq (mağaza locale-i dəyişsə sınmasın).
 */
export function parseConceptDefaultProduct(
  html: string,
  conceptId: string
): ConceptDefaultProduct | null {
  const raw = matchNextData(html);
  if (!raw) return null;

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }

  const apollo = readApolloState(data);
  if (!apollo) return null;

  const conceptKey = Object.keys(apollo).find((k) =>
    k.startsWith(`Concept:${conceptId}:`)
  );
  if (!conceptKey) return null;

  const concept = apollo[conceptKey];
  if (!isRecord(concept)) return null;

  const ref = readRef(concept.defaultProduct);
  if (!ref) return null;

  // `Product:<sku>:<locale>` → ortadakı hissə SKU-dur. SKU id-sində `:`
  // olmadığı üçün baş/son hissəni kəsmək kifayətdir.
  const productId = ref.startsWith("Product:")
    ? ref.slice("Product:".length).replace(/:[^:]*$/, "")
    : null;
  if (!productId || isConceptProductId(productId)) return null;

  const product = apollo[ref];
  const title =
    isRecord(product) && typeof product.name === "string" && product.name.trim()
      ? product.name.trim()
      : null;

  return {
    productId,
    title,
    conceptName:
      typeof concept.name === "string" && concept.name.trim()
        ? concept.name.trim()
        : null,
  };
}

function matchNextData(html: string): string | null {
  const start = html.indexOf('<script id="__NEXT_DATA__"');
  if (start === -1) return null;
  const open = html.indexOf(">", start);
  if (open === -1) return null;
  const end = html.indexOf("</script>", open);
  if (end === -1) return null;
  return html.slice(open + 1, end);
}

function readApolloState(data: unknown): Record<string, unknown> | null {
  if (!isRecord(data)) return null;
  const props = data.props;
  if (!isRecord(props)) return null;
  const pageProps = props.pageProps;
  // apolloState `props.apolloState` altındadır, bəzi səhifələrdə isə
  // `props.pageProps.apolloState` — hər ikisini yoxlayırıq.
  for (const candidate of [props.apolloState, isRecord(pageProps) ? pageProps.apolloState : null]) {
    if (isRecord(candidate)) return candidate;
  }
  return null;
}

function readRef(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const ref = value.__ref;
  return typeof ref === "string" && ref ? ref : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Concept səhifəsini çəkib default SKU-nu qaytarır. Xəta/parse uğursuzluğunda
 * `null` — çağıran tərəf concept sətrini olduğu kimi saxlamalıdır (nəticəni
 * itirməkdənsə köhnə davranışa qayıtmaq yaxşıdır).
 */
export async function fetchConceptDefaultProduct(
  conceptId: string,
  opts: { locale?: string; timeoutMs?: number } = {}
): Promise<ConceptDefaultProduct | null> {
  const locale = opts.locale ?? "tr-tr";
  const url = `https://store.playstation.com/${locale}/concept/${conceptId}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 20_000);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        "Accept-Language": "tr-TR,tr;q=0.9",
      },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    return parseConceptDefaultProduct(await res.text(), conceptId);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
