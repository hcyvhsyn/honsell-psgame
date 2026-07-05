"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";
import { useSession } from "@/components/SessionProvider";
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
  const { reactions, setLocalReaction } = useReelState();

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

  return { myReaction, displayLikes, displayDislikes, inCart, react, buy };
}
