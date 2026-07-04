"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * Reels-lərin CARI istifadəçiyə aid vəziyyəti (bəyəndim/dislike). `/api/reels/state`
 * batch endpoint-indən gəlir (SessionProvider şablonu) — feed səhifəsi statik/edge
 * qalsın deyə server render-də deyil, client-də paint-dən sonra yüklənir.
 *
 * `ensure(ids)` yeni görünən reels id-lərini toplayıb bir sorğuda çəkir (artıq
 * çəkilənləri təkrar sorğulamır). `setLocalReaction` optimistik UI üçün.
 */
type ReelStateCtx = {
  /** reelId → myReaction (1 like | -1 dislike | 0 yox). */
  reactions: Record<string, number>;
  ensure: (ids: string[]) => void;
  setLocalReaction: (reelId: string, value: number) => void;
};

const Ctx = createContext<ReelStateCtx | null>(null);

export function ReelStateProvider({ children }: { children: ReactNode }) {
  const [reactions, setReactions] = useState<Record<string, number>>({});
  const requested = useRef<Set<string>>(new Set());

  const ensure = useCallback((ids: string[]) => {
    const fresh = ids.filter((id) => id && !requested.current.has(id));
    if (fresh.length === 0) return;
    fresh.forEach((id) => requested.current.add(id));

    fetch("/api/reels/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: fresh }),
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : { state: {} }))
      .then((data: { state?: Record<string, { myReaction: number }> }) => {
        const s = data.state ?? {};
        setReactions((prev) => {
          const next = { ...prev };
          for (const id of Object.keys(s)) next[id] = s[id].myReaction;
          return next;
        });
      })
      .catch(() => {
        // uğursuzluqda təkrar cəhdə imkan ver
        fresh.forEach((id) => requested.current.delete(id));
      });
  }, []);

  const setLocalReaction = useCallback((reelId: string, value: number) => {
    setReactions((prev) => ({ ...prev, [reelId]: value }));
  }, []);

  return (
    <Ctx.Provider value={{ reactions, ensure, setLocalReaction }}>{children}</Ctx.Provider>
  );
}

export function useReelState(): ReelStateCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useReelState must be used within ReelStateProvider");
  return ctx;
}
