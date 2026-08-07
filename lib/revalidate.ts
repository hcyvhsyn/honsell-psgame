import { revalidatePath, revalidateTag } from "next/cache";

/**
 * Ana səhifə body-si (`unstable_cache` "home") və header-in user-ə aid olmayan
 * hissəsi ("site-header") custom key ilə keşlənir — `revalidatePath("/")` bunları
 * etibarlı təmizləmir, yalnız `revalidateTag` təmizləyir. Ona görə homepage/header
 * datasına təsir edən hər admin əməliyyatı bu tag-ları da sıfırlamalıdır.
 */
export function revalidateHome(): void {
  revalidateTag("home");
}

export function revalidateSiteHeader(): void {
  revalidateTag("site-header");
}

/** Bütün public oyun səhifələrinin cache-ini sıfırlayır. */
export function revalidateGames(): void {
  revalidateTag("games");
  revalidateTag("home");
  // PERCENT rejimli paketin qiyməti tərkib oyunlarının cari qiymətindən
  // hesablanır — oyun qiyməti dəyişəndə paket vitrini də köhnəlir.
  revalidateTag("bundles");
  revalidatePath("/");
  revalidatePath("/oyunlar");
  revalidatePath("/oyunlar/[slug]", "page");
  revalidatePath("/endirimler");
  revalidatePath("/kolleksiya/[slug]", "page");
  revalidatePath("/paket/[slug]", "page");
}

/** Epic Games kataloqu (scrape sonrası) dəyişəndə. */
export function revalidateEpicGames(): void {
  revalidateTag("epic-games");
  revalidatePath("/epic-games");
}

/** Kolleksiya admin əməliyyatları (CRUD, oyun əlavə/sil/sırala). */
export function revalidateCollections(): void {
  revalidateTag("collections");
  revalidateTag("home");
  revalidatePath("/");
  revalidatePath("/kolleksiya/[slug]", "page");
}

/** Oyun paketləri (səbətlər) admin əməliyyatları — CRUD, oyun əlavə/sil/sırala. */
export function revalidateBundles(): void {
  revalidateTag("bundles");
  revalidateTag("home");
  revalidatePath("/");
  revalidatePath("/paket/[slug]", "page");
}

/** Servis məhsulları (PS Plus, gift cards, hesab açma) dəyişəndə. */
export function revalidateServices(): void {
  revalidateTag("home");
  revalidateTag("site-header");
  revalidatePath("/");
  revalidatePath("/ps-plus");
  revalidatePath("/ea-play");
  revalidatePath("/hediyye-kartlari");
  revalidatePath("/hesab-acma");
  revalidatePath("/streaming");
  // `/playstation` həm PS Plus, həm TRY hədiyyə kartlarını göstərir
  // (app/playstation/page.tsx) — bura əlavə olunmasa qiymət/sıra dəyişikliyi
  // orada ISR müddəti bitənə qədər köhnə qalırdı.
  revalidatePath("/playstation");
}

/** Banner-lər admin paneldən dəyişdirildikdə. */
export function revalidateBanners(): void {
  revalidateTag("home");
  revalidatePath("/");
  revalidatePath("/playstation");
}

/** "Fürsətləri qaçırma" kampaniya kartları admin paneldən dəyişdirildikdə. */
export function revalidateFlashDeals(): void {
  revalidateTag("home");
  revalidatePath("/");
}

/** Qutu açılışı (loot box) — admin CRUD və hovuz yaratma sonrası. */
export function revalidateLootBoxes(): void {
  revalidateTag("loot-boxes");
  revalidateTag("home");
  revalidatePath("/");
  revalidatePath("/qutular");
  revalidatePath("/qutu/[slug]", "page");
}

/** Reels feed (admin video CRUD) dəyişəndə — ilk səhifə RSC keşini sıfırlayır. */
export function revalidateReels(): void {
  revalidateTag("reels");
  revalidatePath("/reels");
}

/** Streaming title və featured banner dəyişiklikləri. */
export function revalidateStreaming(): void {
  revalidateTag("home");
  revalidatePath("/");
  revalidatePath("/streaming");
  revalidatePath("/streaming/[slug]", "page");
}
