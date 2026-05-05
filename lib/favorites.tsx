"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type FavCtx = {
  /** Logged-in flag from the server (null = unknown / unauthenticated). */
  isAuthed: boolean;
  /** Current set of favorited gameIds. */
  ids: Set<string>;
  hydrated: boolean;
  has: (gameId: string) => boolean;
  /**
   * Toggle a game's favorite state. Returns the new state (true = favorited).
   * On first add per device, the popup is also triggered (consumed via
   * `consumeIntroPopup`).
   */
  toggle: (gameId: string) => Promise<boolean>;
  /** Returns true and clears the flag — caller shows the intro popup. */
  consumeIntroPopup: () => boolean;
  /** When the user is anonymous and tries to favorite — caller should open login. */
  onUnauthorized?: () => void;
};

const Ctx = createContext<FavCtx | null>(null);

const INTRO_FLAG = "honsell.fav.introSeen.v1";

export function FavoritesProvider({
  initialAuthed,
  initialIds,
  children,
  onUnauthorized,
}: {
  initialAuthed: boolean;
  initialIds: string[];
  onUnauthorized?: () => void;
  children: React.ReactNode;
}) {
  const [ids, setIds] = useState<Set<string>>(() => new Set(initialIds));
  const [hydrated, setHydrated] = useState(false);
  const introQueuedRef = useRef(false);

  // Hydrate from server once on mount (covers stale SSR snapshots after login).
  useEffect(() => {
    if (!initialAuthed) {
      setHydrated(true);
      return;
    }
    let cancelled = false;
    fetch("/api/favorites", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data: { ids: string[] }) => {
        if (cancelled) return;
        setIds(new Set(data.ids));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, [initialAuthed]);

  const has = useCallback((gameId: string) => ids.has(gameId), [ids]);

  const toggle = useCallback(
    async (gameId: string): Promise<boolean> => {
      if (!initialAuthed) {
        onUnauthorized?.();
        return false;
      }

      const wasFav = ids.has(gameId);
      // Optimistic update
      setIds((prev) => {
        const next = new Set(prev);
        if (wasFav) next.delete(gameId);
        else next.add(gameId);
        return next;
      });

      // First-add intro popup (one-time per device)
      if (!wasFav && typeof window !== "undefined") {
        try {
          const seen = window.localStorage.getItem(INTRO_FLAG);
          if (!seen) introQueuedRef.current = true;
        } catch {}
      }

      try {
        const res = await fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gameId, action: wasFav ? "remove" : "add" }),
        });
        if (!res.ok) throw new Error("favorite request failed");
        const data: { favorited: boolean } = await res.json();
        // Reconcile in case server disagrees.
        setIds((prev) => {
          const next = new Set(prev);
          if (data.favorited) next.add(gameId);
          else next.delete(gameId);
          return next;
        });
        return data.favorited;
      } catch {
        // Roll back on error
        setIds((prev) => {
          const next = new Set(prev);
          if (wasFav) next.add(gameId);
          else next.delete(gameId);
          return next;
        });
        return wasFav;
      }
    },
    [ids, initialAuthed, onUnauthorized]
  );

  const consumeIntroPopup = useCallback(() => {
    if (!introQueuedRef.current) return false;
    introQueuedRef.current = false;
    try {
      window.localStorage.setItem(INTRO_FLAG, "1");
    } catch {}
    return true;
  }, []);

  const value = useMemo<FavCtx>(
    () => ({
      isAuthed: initialAuthed,
      ids,
      hydrated,
      has,
      toggle,
      consumeIntroPopup,
      onUnauthorized,
    }),
    [initialAuthed, ids, hydrated, has, toggle, consumeIntroPopup, onUnauthorized]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFavorites(): FavCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useFavorites must be used inside FavoritesProvider");
  return ctx;
}
