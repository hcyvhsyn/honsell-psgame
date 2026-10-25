"use client";

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";

/**
 * Client-side sessiya konteksti. `/api/session`-i SƏHIFƏ BAŞINA BİR DƏFƏ çəkir
 * və header, referral promo bar, referral CTA, "rəy yaz" düyməsi bunu paylaşır
 * (4 ayrı fetch əvəzinə 1). Bu, həmin komponentlərin user-vəziyyətini server
 * render-dən çıxarır → səhifələr statik/edge-keşlənən ola bilir.
 */
export type SessionUser = {
  name: string | null;
  walletBalanceCents: number;
  cashbackBalanceCents: number;
  referralCode: string | null;
  earnedAznCents: number;
  hasPurchases: boolean;
};

type SessionState = {
  user: SessionUser | null;
  /** true = hələ /api/session cavabı gəlməyib (header skeleton göstər). */
  loading: boolean;
};

const SessionContext = createContext<SessionState>({ user: null, loading: true });

// Son uğurlu sessiya cihazda saxlanılır ki, header-dəki ad/balans `/api/session`
// cavabını gözləmədən İLK paint-də görünsün (əvvəl hər yükləmədə skeleton
// görünürdü). Cavab gələndə keş təzələnir; balans bir anlıq köhnə ola bilər.
// Yalnız daxil olmuş user keşlənir — qonaq üçün skeleton qalır, yoxsa login-dən
// sonra bir an "Daxil ol" görünərdi.
const SESSION_CACHE_KEY = "honsell.session.v1";

function readCachedSession(): SessionUser | null {
  try {
    const raw = window.localStorage.getItem(SESSION_CACHE_KEY);
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    return null;
  }
}

function writeCachedSession(user: SessionUser | null) {
  try {
    if (user) window.localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(user));
    else window.localStorage.removeItem(SESSION_CACHE_KEY);
  } catch {
    /* ignore */
  }
}

/** Çıxışda çağır — yoxsa növbəti səhifədə köhnə ad bir an görünər. */
export function clearCachedSession() {
  writeCachedSession(null);
}

// SSR-də useLayoutEffect xəbərdarlığı verməsin deyə.
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ user: null, loading: true });

  // Hidrasiyadan dərhal sonra, brauzer ekranı rəsm etməzdən ƏVVƏL keşi tətbiq et.
  // İlkin state SSR ilə eyni qalır (loading), ona görə hidrasiya uyğunsuzluğu olmur.
  useIsomorphicLayoutEffect(() => {
    const cached = readCachedSession();
    if (cached) setState((prev) => (prev.loading ? { user: cached, loading: false } : prev));
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/session", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((data: { user?: SessionUser | null }) => {
        if (cancelled) return;
        writeCachedSession(data.user ?? null);
        setState({ user: data.user ?? null, loading: false });
      })
      .catch(() => {
        if (!cancelled) setState((prev) => (prev.user ? prev : { user: null, loading: false }));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  return useContext(SessionContext);
}
