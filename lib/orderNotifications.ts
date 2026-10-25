import { isWasenderConfigured, normalizeToE164, sendWasenderText } from "@/lib/wasender";

/**
 * Admin sifariş təsdiqi anında müştəriyə WhatsApp təsdiq mesajı göndərir.
 * Sənədsiz şəkildə uğursuz olur (telefon yoxdursa, WaSender konfiqurasiya
 * olunmayıbsa və ya API səhv qaytarsa) — log-a yazır, sifariş axınını dayandırmır.
 */
export async function sendOrderApprovedWhatsApp(params: {
  phone: string | null | undefined;
  userName?: string | null;
  productTitle?: string | null;
  /** "honsell-gift-card" | "platform" | "streaming" | "ai" | "music" | "work" | "try-balance" və s. */
  kind?: string;
  /** Mesaja əlavə olunan extra sətir (məs. "Kodunuz email-ə göndərildi."). */
  extraLine?: string;
  /** Sifarişin rəy linki (`issueReviewInvite`) — mesajın SONUNA əlavə olunur. */
  reviewUrl?: string | null;
}): Promise<{ ok: boolean; reason?: string }> {
  if (!isWasenderConfigured()) {
    return { ok: false, reason: "WASENDER_NOT_CONFIGURED" };
  }
  const to = normalizeToE164(params.phone);
  if (!to) {
    return { ok: false, reason: "PHONE_INVALID" };
  }

  const greeting = params.userName?.trim() ? `Salam, ${params.userName.trim()}!` : "Salam!";
  const product = params.productTitle?.trim()
    ? `«${params.productTitle.trim()}»`
    : "sifarişiniz";
  const extra = params.extraLine?.trim() ? `\n\n${params.extraLine.trim()}` : "";
  const review = params.reviewUrl
    ? `\n\n⭐ Təcrübənizi bəyəndinizsə, rəyinizi bizimlə bölüşün:\n${params.reviewUrl}`
    : "";

  const text =
    `${greeting}\n\n` +
    `${product} üzrə sifarişiniz tamamlandı və tərəfimizdən təsdiqləndi. ✅` +
    `${extra}\n\n` +
    `Daha ətraflı: honsell.site/profile/orders\n` +
    `Honsell.store` +
    review;

  try {
    const res = await sendWasenderText({ to, text });
    if (!res.ok) {
      console.error("order whatsapp send failed", { kind: params.kind, reason: res.error });
      return { ok: false, reason: res.error };
    }
    return { ok: true };
  } catch (err) {
    console.error("order whatsapp threw", { kind: params.kind, err });
    return { ok: false, reason: err instanceof Error ? err.message : "unknown" };
  }
}

/**
 * Sifarişi icra etmək üçün admin müştərinin PlayStation hesabına daxil olur;
 * giriş anında müştəriyə PlayStation tərəfindən təsdiq kodu (OTP) gəlir.
 * Bu funksiya həmin kodu istəyən WhatsApp mesajını müştəriyə göndərir.
 * Səssizcə uğursuz olur (telefon yox / WaSender konfiqurasiya olunmayıb).
 */
export async function sendPsnOtpRequestWhatsApp(params: {
  phone: string | null | undefined;
  userName?: string | null;
  productTitle?: string | null;
}): Promise<{ ok: boolean; reason?: string }> {
  if (!isWasenderConfigured()) {
    return { ok: false, reason: "WASENDER_NOT_CONFIGURED" };
  }
  const to = normalizeToE164(params.phone);
  if (!to) {
    return { ok: false, reason: "PHONE_INVALID" };
  }

  const greeting = params.userName?.trim() ? `Salam, ${params.userName.trim()}!` : "Salam!";
  const product = params.productTitle?.trim()
    ? `«${params.productTitle.trim()}» sifarişinizi`
    : "sifarişinizi";

  const text =
    `${greeting}\n\n` +
    `${product} tamamlamaq üçün PlayStation hesabınıza daxil oluruq. ` +
    `Girişi təsdiqləmək məqsədilə PlayStation tərəfindən sizə indi göndərilən ` +
    `təsdiq kodunu (OTP) bizə bildirin. ✅\n\n` +
    `Qeyd: Bu kodu yalnız bu sifarişin icrası üçün istəyirik.\n\n` +
    `Honsell.store`;

  try {
    const res = await sendWasenderText({ to, text });
    if (!res.ok) {
      console.error("psn otp request whatsapp send failed", { reason: res.error });
      return { ok: false, reason: res.error };
    }
    return { ok: true };
  } catch (err) {
    console.error("psn otp request whatsapp threw", { err });
    return { ok: false, reason: err instanceof Error ? err.message : "unknown" };
  }
}

/**
 * Müştəri admin tərəfindən "Sponsorlu" statusuna keçirildikdə ona WhatsApp ilə
 * artırılmış oyun referal faizi barədə məlumat verir. Səssizcə uğursuz olur
 * (telefon yoxdursa / WaSender konfiqurasiya olunmayıbsa) — admin axınını saxlamır.
 */
export async function sendSponsoredWhatsApp(params: {
  phone: string | null | undefined;
  userName?: string | null;
  /** Oyun referal faizi (məs. 8). */
  pct: number;
  /** Müştərinin referal kodu — mesaja əlavə olunur. */
  referralCode?: string | null;
}): Promise<{ ok: boolean; reason?: string }> {
  if (!isWasenderConfigured()) {
    return { ok: false, reason: "WASENDER_NOT_CONFIGURED" };
  }
  const to = normalizeToE164(params.phone);
  if (!to) {
    return { ok: false, reason: "PHONE_INVALID" };
  }

  const greeting = params.userName?.trim() ? `Salam, ${params.userName.trim()}!` : "Salam!";
  const pct = Number.isFinite(params.pct) ? params.pct : 8;
  const codeLine = params.referralCode?.trim()
    ? `\n\nReferal kodunuz: ${params.referralCode.trim()}`
    : "";

  const text =
    `${greeting}\n\n` +
    `Təbriklər! 🎉 Hesabınız Honsell.store-da *sponsor* statusu aldı.\n\n` +
    `Bundan sonra referal linkinizlə qeydiyyatdan keçən istifadəçilərin ` +
    `*oyun alışlarından* ${pct}% bonus qazanacaqsınız. Bonus referal balansınıza yığılır.` +
    `${codeLine}\n\n` +
    `Honsell.store`;

  try {
    const res = await sendWasenderText({ to, text });
    if (!res.ok) {
      console.error("sponsored whatsapp send failed", { reason: res.error });
      return { ok: false, reason: res.error };
    }
    return { ok: true };
  } catch (err) {
    console.error("sponsored whatsapp threw", { err });
    return { ok: false, reason: err instanceof Error ? err.message : "unknown" };
  }
}

/**
 * Müştərinin favoritindəki oyun endirimə düşəndə anlıq WhatsApp bildirişi.
 * Hibrid strategiyanın WhatsApp tərəfi — müştəri bu oyunu özü izlədiyi üçün
 * mesaj gözləniləndir (spam deyil). Səssizcə uğursuz olur (telefon yox / WaSender
 * konfiqurasiya olunmayıb) — scrape axınını dayandırmır.
 */
export async function sendFavoriteOnSaleWhatsApp(params: {
  phone: string | null | undefined;
  userName?: string | null;
  productTitle: string;
  productId: string;
  finalAzn: number;
  discountPct?: number | null;
  discountEndAt?: Date | null;
}): Promise<{ ok: boolean; reason?: string }> {
  if (!isWasenderConfigured()) {
    return { ok: false, reason: "WASENDER_NOT_CONFIGURED" };
  }
  const to = normalizeToE164(params.phone);
  if (!to) {
    return { ok: false, reason: "PHONE_INVALID" };
  }

  const greeting = params.userName?.trim() ? `Salam, ${params.userName.trim()}!` : "Salam!";
  const pctLine =
    params.discountPct != null && params.discountPct > 0 ? ` *-${params.discountPct}%*` : "";
  const endLine = params.discountEndAt
    ? `\nEndirim bitir: ${params.discountEndAt.toLocaleDateString("az-AZ", {
        day: "numeric",
        month: "long",
      })}`
    : "";
  const link = `honsell.site/oyunlar/${params.productId}`;

  const text =
    `${greeting}\n\n` +
    `Favoritinizdəki *${params.productTitle}* endirimə düşdü!${pctLine}\n` +
    `Yeni qiymət: *${params.finalAzn.toFixed(2)} AZN*${endLine}\n\n` +
    `${link}\n` +
    `Honsell.store`;

  try {
    const res = await sendWasenderText({ to, text });
    if (!res.ok) {
      console.error("favorite-on-sale whatsapp send failed", { reason: res.error });
      return { ok: false, reason: res.error };
    }
    return { ok: true };
  } catch (err) {
    console.error("favorite-on-sale whatsapp threw", { err });
    return { ok: false, reason: err instanceof Error ? err.message : "unknown" };
  }
}

/**
 * Admin əl ilə qeyd etdiyi "qiyməti baha görən" müştəriyə endirim xəbəri.
 *
 * `sendFavoriteOnSaleWhatsApp`-dan mətni ilə fərqlənir və bu QƏSDƏNDİR: bu
 * müştəri saytda favorit qoymamışdır — ona "favoritinizdəki oyun" yazsan nədən
 * danışdığımızı anlamaz. Əvəzinə söhbətə istinad olunur ("soruşduğunuz oyun").
 *
 * Köhnə qiymət verilibsə mesajda göstərilir — müştərinin etirazı məhz qiymət
 * olduğu üçün "62 → 45" müqayisəsi tək rəqəmdən güclüdür.
 */
export async function sendPriceWatchWhatsApp(params: {
  phone: string | null | undefined;
  customerName?: string | null;
  productTitle: string;
  productId: string;
  finalAzn: number;
  /** Güdmə qeyd olunanda gördüyümüz qiymət — varsa "əvvəl X idi" sətri çıxır. */
  basePriceAzn?: number | null;
  discountPct?: number | null;
  discountEndAt?: Date | null;
}): Promise<{ ok: boolean; reason?: string }> {
  if (!isWasenderConfigured()) {
    return { ok: false, reason: "WASENDER_NOT_CONFIGURED" };
  }
  const to = normalizeToE164(params.phone);
  if (!to) {
    return { ok: false, reason: "PHONE_INVALID" };
  }

  const greeting = params.customerName?.trim()
    ? `Salam, ${params.customerName.trim()}! 👋`
    : "Salam! 👋";
  const pctLine =
    params.discountPct != null && params.discountPct > 0 ? ` *-${params.discountPct}%*` : "";
  // Yalnız REAL enmə göstərilir: baza qiyməti yeni qiymətdən böyük olmalıdır,
  // yoxsa "əvvəl 45 idi, indi 45" kimi mənasız sətir çıxar.
  const beforeLine =
    params.basePriceAzn != null && params.basePriceAzn > params.finalAzn
      ? `\nSoruşduğunuz vaxt: ~${params.basePriceAzn.toFixed(2)} AZN~`
      : "";
  const endLine = params.discountEndAt
    ? `\n⏳ Endirim bitir: ${params.discountEndAt.toLocaleDateString("az-AZ", {
        day: "numeric",
        month: "long",
      })}`
    : "";
  const link = `honsell.site/oyunlar/${params.productId}`;

  const text =
    `${greeting}\n\n` +
    `Soruşduğunuz *${params.productTitle}* endirimə düşdü!${pctLine}\n` +
    `Yeni qiymət: *${params.finalAzn.toFixed(2)} AZN*${beforeLine}${endLine}\n\n` +
    `${link}\n` +
    `Honsell.store`;

  try {
    const res = await sendWasenderText({ to, text });
    if (!res.ok) {
      console.error("price-watch whatsapp send failed", { reason: res.error });
      return { ok: false, reason: res.error };
    }
    return { ok: true };
  } catch (err) {
    console.error("price-watch whatsapp threw", { err });
    return { ok: false, reason: err instanceof Error ? err.message : "unknown" };
  }
}
