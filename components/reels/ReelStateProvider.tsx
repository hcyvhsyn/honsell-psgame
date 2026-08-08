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
  /** reelId → izləmə siyahısındadır (yalnız film/serial; oyunlar favoritlərdədir). */
  saved: Record<string, boolean>;
  ensure: (ids: string[]) => void;
  setLocalReaction: (reelId: string, value: number) => void;
  setLocalSaved: (reelId: string, value: boolean) => void;
  /**
   * reelId → seçilmiş sürümün Game.id-si.
   *
   * NİYƏ CONTEXT-DƏ: sürüm çipləri `ReelBuyPanel`-dədir (ReelSlot içində), amma
   * "Saxla" düyməsi həm orada, həm də DESKTOP yan raildədir (ReelSideRail,
   * ReelSlot-dan kənarda). Hər ikisi eyni seçimi görməlidir, yoxsa istifadəçi
   * Ultimate sürümə baxıb saxlayanda favoritlərə Standart düşər.
   */
  selectedEditions: Record<string, string>;
  setSelectedEdition: (reelId: string, gameId: string) => void;
};

const Ctx = createContext<ReelStateCtx | null>(null);

export function ReelStateProvider({ children }: { children: ReactNode }) {
  const [reactions, setReactions] = useState<Record<string, number>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [selectedEditions, setSelectedEditions] = useState<Record<string, string>>({});
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
      .then((data: { state?: Record<string, { myReaction: number; saved?: boolean }> }) => {
        const s = data.state ?? {};
        setReactions((prev) => {
          const next = { ...prev };
          for (const id of Object.keys(s)) next[id] = s[id].myReaction;
          return next;
        });
        setSaved((prev) => {
          const next = { ...prev };
          for (const id of Object.keys(s)) next[id] = Boolean(s[id].saved);
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

  const setLocalSaved = useCallback((reelId: string, value: boolean) => {
    setSaved((prev) => ({ ...prev, [reelId]: value }));
  }, []);

  const setSelectedEdition = useCallback((reelId: string, gameId: string) => {
    setSelectedEditions((prev) => (prev[reelId] === gameId ? prev : { ...prev, [reelId]: gameId }));
  }, []);

  return (
    <Ctx.Provider
      value={{
        reactions,
        saved,
        ensure,
        setLocalReaction,
        setLocalSaved,
        selectedEditions,
        setSelectedEdition,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useReelState(): ReelStateCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useReelState must be used within ReelStateProvider");
  return ctx;
}
