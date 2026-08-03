/**
 * PS Store məhsul (detal) səhifəsindən QİYMƏT və ENDİRİM MÜDDƏTİ çıxarışı.
 *
 * ─── NİYƏ REGEX ƏVƏZİNƏ JSON ─────────────────────────────────────────────────
 * Əvvəl bu iş iki ayrı regex ilə görülürdü və hər ikisinin kökündə eyni səhv
 * var idi: bir məhsul səhifəsi YALNIZ o məhsulun təklifini daşımır.
 *
 * Ölçülmüş real nümunə (Call of Duty BO7 Vault səhifəsi) — 9 təklif, 7 FƏRQLİ
 * məhsula aid:
 *   CODBO7VAULT00001-E006   base=439900 disc=439900 endTime=null
 *   CODMW4VAULT00001-E002   base=439900 disc=439900 endTime=null
 *   CODBO7CROSSGEN01-E004   base=319900 disc=159950 endTime=1786575540000
 *   CODMW4STANDARD01-E002   base=319900 disc=319900 endTime=null
 *   CODMW2CROSSGEN01-E00H   base=251999 disc=251999 endTime=null
 *   CODBO6CROSSGEN01-E00F   base=279900 disc=111960 endTime=1786575540000
 *   …
 * Köhnə `fetchProductPrice` "ilk `serviceBranding:["NONE"]` təklifini" alırdı və
 * onu MÖTƏBƏR qiymət kimi yazırdı. Yəni sıralama təsadüfən düz gəlmədikdə sətrə
 * BAŞQA məhsulun qiyməti, endirimi və bitmə tarixi yazılırdı. Burada təklif
 * SKU açarına görə çəngəllənir (`GameCTA:…:<productId>-E###:OUTRIGHT`), ona görə
 * yalnız istənilən məhsulun öz təklifi nəzərə alınır.
 *
 * ─── NİYƏ İKİ TARİX MƏNBƏYİ ──────────────────────────────────────────────────
 * Bitmə anı səhifədə iki yerdə var və hər ikisi lazımdır:
 *   `price.endTime`            → epoch ms (sətir kimi), bəzən null
 *   `local.offerAvailability`  → ISO tarix, endirimli CTA-larda dolu
 * Köhnə kod bunları iki müxtəlif funksiyada, ayrı-ayrı oxuyurdu: listinq
 * fazası `offerAvailability`-yə baxırdı, stale-refresh fazası isə YALNIZ
 * `endTime`-a. `endTime` null olanda refresh fazası `discountEndAt`-ı null yazıb
 * listinq fazasının tapdığı tarixi SİLİRDİ. Hər aktiv sətir bir neçə işləmədə
 * refresh rotasiyasından keçdiyi üçün silinmə vaxtla tam olurdu — kataloqda
 * endirim bitiş tarixinin heç vaxt görünməməsinin səbəbi budur.
 */
import { collectBatarangCaches, prop } from "@/lib/psStoreMetadata";

export type PsStoreOffer = {
  /** Baza qiymət, kuruş (TRY × 100). */
  priceTryCents: number;
  /** Endirimli qiymət, kuruş. Aktiv endirim yoxdursa null. */
  discountTryCents: number | null;
  /** Endirimin bitmə anı. Endirim yoxdursa və ya tarix bilinmirsə null. */
  discountEndAt: Date | null;
};

function num(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** `endTime` epoch ms (sətir və ya rəqəm) → Date. */
function fromEpochMs(value: unknown): Date | null {
  const ms = num(value);
  if (ms == null || ms <= 0) return null;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** `offerAvailability` ISO sətri → Date. */
function fromIso(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

type Candidate = {
  base: number;
  discounted: number | null;
  endAt: Date | null;
};

/**
 * Verilmiş `productId` üçün mağazanın göstərdiyi alış təklifini qaytarır.
 *
 * Abunə tarifləri (EA Play, PS Plus) atılır — `serviceBranding` massivində
 * yalnız "NONE" olan təklif müştərinin faktiki ödədiyi qiymətdir.
 *
 * `null` qaytarır: səhifə parse olunmadı, bu məhsulun TRY təklifi yoxdur
 * (silinmiş / regional bloklanmış). Çağıran tərəf null-u "qiymətə toxunma"
 * kimi oxumalıdır.
 */
export function parsePsStoreOffer(
  html: string,
  productId: string
): PsStoreOffer | null {
  const cache = collectBatarangCaches(html);
  if (Object.keys(cache).length === 0) return null;

  const candidates: Candidate[] = [];

  for (const [key, entry] of Object.entries(cache)) {
    if (!key.startsWith("GameCTA:")) continue;
    // SKU açarı `<productId>-E006` formasındadır. Defis tələb olunur ki,
    // "…CODBO7VAULT00001" sorğusu "…CODBO7VAULT000012" kimi başqa məhsulu
    // tutmasın.
    if (!key.includes(`${productId}-`)) continue;

    const price = prop(entry, "price");
    if (!price) continue;
    if (prop(price, "currencyCode") !== "TRY") continue;

    const branding = prop(price, "serviceBranding");
    // Abunə tarifi (EA_ACCESS, PS_PLUS, …) — alış qiyməti deyil.
    if (!Array.isArray(branding) || !branding.every((b) => b === "NONE")) continue;

    const base = num(prop(price, "basePriceValue"));
    if (base == null || base <= 0) continue;

    const rawDisc = num(prop(price, "discountedValue"));
    // discountedValue === 0 abunə ilə "daxildir" halıdır, endirim deyil.
    const discounted =
      rawDisc != null && rawDisc > 0 && rawDisc < base ? rawDisc : null;

    // Tarix: əvvəl `endTime`, sonra CTA-nın `offerAvailability` sahəsi.
    // Yalnız endirim varsa mənalıdır.
    const endAt =
      discounted != null
        ? (fromEpochMs(prop(price, "endTime")) ??
           fromIso(prop(prop(entry, "local"), "offerAvailability")))
        : null;

    candidates.push({ base, discounted, endAt });
  }

  if (candidates.length === 0) return null;

  // Bir məhsulun bir neçə CTA-sı ola bilər (ADD_TO_CART + BUY_NOW eyni SKU
  // üçün). Endirimli olanı üstün tutur: mağaza istifadəçiyə endirimli qiyməti
  // göstərir, ona görə kataloq da onu göstərməlidir. Bərabər halda ən aşağı
  // faktiki qiymət seçilir.
  const effective = (c: Candidate) => c.discounted ?? c.base;
  candidates.sort((a, b) => {
    if ((a.discounted != null) !== (b.discounted != null)) {
      return a.discounted != null ? -1 : 1;
    }
    return effective(a) - effective(b);
  });

  const best = candidates[0];
  return {
    priceTryCents: best.base,
    discountTryCents: best.discounted,
    discountEndAt: best.endAt,
  };
}
