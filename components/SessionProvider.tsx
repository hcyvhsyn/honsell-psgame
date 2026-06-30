"use client";

import {
  createContext,
  useContext,
  useEffect,
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

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ user: null, loading: true });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/session", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((data: { user?: SessionUser | null }) => {
        if (!cancelled) setState({ user: data.user ?? null, loading: false });
      })
      .catch(() => {
        if (!cancelled) setState({ user: null, loading: false });
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
