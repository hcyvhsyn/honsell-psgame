"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";
import { useSession } from "@/components/SessionProvider";
import { useFavorites } from "@/lib/favorites";
import { useReelState } from "./ReelStateProvider";
import type { ReelFeedItem } from "./types";

/**
 * Bir reel-in like/dislike/səbət məntiqi — həm mobil overlay rail, həm desktop
 * yan panel üçün ORTAQ. Sayları saf funksiya kimi hesablayır (delta toplamadan)
 * və Math.max(0,…) ilə mənfiyə düşməyi əngəlləyir (feed keşi köhnə olsa da).
 *
 * QEYD: baseline per-instance ref-dədir; hər fərqli reel üçün ayrıca çağırılmalıdır
 * (desktop yan panel `key={item.id}` ilə remount olunmalıdır ki, baseline sıfırlansın).
 */
export function useReelInteractions(item: ReelFeedItem) {
  const router = useRouter();
  const { add, has } = useCart();
  const { user } = useSession();
  const { reactions, saved, setLocalReaction, setLocalSaved, selectedEditions } = useReelState();
  const favorites = useFavorites();

  const myReaction = reactions[item.id] ?? 0;
  const baselineRef = useRef(0);
  const interactedRef = useRef(false);
  if (!interactedRef.current) baselineRef.current = myReaction;
  const baseline = baselineRef.current;

  const displayLikes = Math.max(
    0,
    item.counts.likes - (baseline === 1 ? 1 : 0) + (myReaction === 1 ? 1 : 0),
  );
  const displayDislikes = Math.max(
    0,
    item.counts.dislikes - (baseline === -1 ? 1 : 0) + (myReaction === -1 ? 1 : 0),
  );

  const productId = item.cta.product?.id ?? null;
  const inCart = productId ? has(productId) : false;
  const [copied, setCopied] = useState(false);

  // ─── "Saxla" ────────────────────────────────────────────────────────────────
  // Oyun → mövcud FAVORİTLƏR (orada endirim bildirişləri var və saxlanan şey
  // konkret oyundur). Film/serial → heç bir məhsula bağlı deyil, ona görə REEL-in
  // özü `ReelBookmark`-a yazılır.
  //
  // Favoritə düşən oyun panelde SEÇİLİ sürümdür: istifadəçi Ultimate-ə baxıb
  // saxlayırsa favoritlərdə Standart görməməlidir.
  const saveGameId =
    item.category === "GAME"
      ? (selectedEditions[item.id] ?? item.cta.editions[0]?.id ?? productId)
      : null;
  const isSaved = saveGameId ? favorites.has(saveGameId) : (saved[item.id] ?? false);

  async function react(value: 1 | -1) {
    if (!user) {
      router.push("/login?next=/reels");
      return;
    }
    interactedRef.current = true;
    const prev = myReaction;
    const next = prev === value ? 0 : value;
    setLocalReaction(item.id, next);
    try {
      const res = await fetch(`/api/reels/${item.id}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      const data = await res.json();
      if (res.ok && typeof data.myReaction === "number") setLocalReaction(item.id, data.myReaction);
      else if (!res.ok) setLocalReaction(item.id, prev);
    } catch {
      setLocalReaction(item.id, prev);
    }
  }

  /** CTA: məhsulu səbətə əlavə edir (səhifədə qalır); artıq səbətdədirsə /cart-a keçir.
   *  URL CTA-sı isə linki açır. */
  function buy() {
    const p = item.cta.product;
    if (p) {
      if (has(p.id)) {
        router.push("/cart");
        return;
      }
      add({
        id: p.id,
        title: p.title,
        imageUrl: p.imageUrl,
        finalAzn: p.finalAzn,
        productType: p.productType,
        ...(p.store && p.store !== "SERVICE" ? { store: p.store } : {}),
      });
    } else if (item.cta.href) {
      window.open(item.cta.href, "_blank", "noopener");
    }
  }

  /**
   * Paylaşma — `/reels?r=<id>` deep link-i (həmin videodan başlayır).
   *
   * Mobil brauzerlərdə native paylaşma vərəqi açılır; masaüstündə `navigator.share`
   * olmadığı üçün link buferə kopyalanır və düymə qısa müddət "Kopyalandı" göstərir.
   */
  async function share() {
    const url = `${window.location.origin}/reels?r=${item.id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: item.title || "Honsell Reels", url });
        return;
      } catch {
        // İstifadəçi ləğv etdi (AbortError) və ya paylaşma alınmadı → kopyalamaya keç.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard HTTPS tələb edir; alınmasa səssizcə keç */
    }
  }

  /** "Saxla" toggle-ı — oyun favoritlərə, film/serial izləmə siyahısına. */
  async function toggleSave() {
    if (!user) {
      router.push("/login?next=/reels");
      return;
    }
    if (saveGameId) {
      // `useFavorites().toggle` optimistik yeniləmə + geri qaytarmanı özü edir.
      await favorites.toggle(saveGameId);
      return;
    }

    const next = !isSaved;
    setLocalSaved(item.id, next); // optimistik
    try {
      const res = await fetch(`/api/reels/${item.id}/bookmark`, { method: "POST" });
      const data = await res.json();
      if (res.ok && typeof data.saved === "boolean") setLocalSaved(item.id, data.saved);
      else setLocalSaved(item.id, !next);
    } catch {
      setLocalSaved(item.id, !next);
    }
  }

  return {
    myReaction,
    displayLikes,
    displayDislikes,
    inCart,
    copied,
    isSaved,
    react,
    buy,
    share,
    toggleSave,
  };
}
