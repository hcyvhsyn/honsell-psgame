import { revalidatePath, revalidateTag } from "next/cache";

/** Bütün public oyun səhifələrinin cache-ini sıfırlayır. */
export function revalidateGames(): void {
  revalidateTag("games");
  revalidatePath("/");
  revalidatePath("/oyunlar");
  revalidatePath("/oyunlar/[productId]", "page");
  revalidatePath("/endirimler");
  revalidatePath("/kolleksiya/[slug]", "page");
}

/** Kolleksiya admin əməliyyatları (CRUD, oyun əlavə/sil/sırala). */
export function revalidateCollections(): void {
  revalidateTag("collections");
  revalidatePath("/");
  revalidatePath("/kolleksiya/[slug]", "page");
}

/** Servis məhsulları (PS Plus, gift cards, hesab açma) dəyişəndə. */
export function revalidateServices(): void {
  revalidatePath("/");
  revalidatePath("/ps-plus");
  revalidatePath("/hediyye-kartlari");
  revalidatePath("/hesab-acma");
}

/** Banner-lər admin paneldən dəyişdirildikdə. */
export function revalidateBanners(): void {
  revalidatePath("/");
}
