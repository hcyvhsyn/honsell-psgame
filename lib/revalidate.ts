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
  revalidatePath("/");
  revalidatePath("/oyunlar");
  revalidatePath("/oyunlar/[productId]", "page");
  revalidatePath("/endirimler");
  revalidatePath("/kolleksiya/[slug]", "page");
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
}

/** Banner-lər admin paneldən dəyişdirildikdə. */
export function revalidateBanners(): void {
  revalidateTag("home");
  revalidatePath("/");
  revalidatePath("/playstation");
}

/** Streaming title və featured banner dəyişiklikləri. */
export function revalidateStreaming(): void {
  revalidateTag("home");
  revalidatePath("/");
  revalidatePath("/streaming");
  revalidatePath("/streaming/[slug]", "page");
}
