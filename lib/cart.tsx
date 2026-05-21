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

/** Səbətdə PSN hesab açılışı üçün müştəri məlumatları (checkout zamanı serverə göndərilir). */
export type AccountCreationCartDetails = {
  fullName: string;
  birthDate: string;
  email: string;
  password: string;
};

/**
 * Gmail-yönlü xidmətlər üçün müştəri məlumatları.
 *   - YouTube Premium üçün həm `gmail` həm `password` tələb olunur
 *     (admin müştərinin hesabına abunəliyi qoşur).
 *   - Digər streaming xidmətlərində (Netflix və s.) yalnız `gmail` istifadə olunur.
 *   - `platformKind` — cart UI-də doğru etiket göstərə bilmək üçün
 *     PLATFORM məhsullarında ("LINKEDIN" / "YOUTUBE" və s.) qeyd olunur.
 */
export type StreamingCartDetails = {
  gmail: string;
  password?: string;
  platformKind?: string;
};

export type CartItem = {
  id: string;
  title: string;
  imageUrl: string | null;
  finalAzn: number;
  productType: string;
  qty: number;
  accountCreation?: AccountCreationCartDetails;
  streaming?: StreamingCartDetails;
};

/** Qiymət dəyişikliyi / artıq mövcud olmayan məhsul bildirişi. */
export type CartPriceChange =
  | { kind: "price"; id: string; title: string; oldAzn: number; newAzn: number }
  | { kind: "removed"; id: string; title: string };

type CartContextValue = {
  items: CartItem[];
  count: number;
  totalAzn: number;
  add: (item: Omit<CartItem, "qty">) => void;
  setQty: (id: string, qty: number) => void;
  updateAccountCreation: (id: string, details: AccountCreationCartDetails) => void;
  updateStreaming: (id: string, details: StreamingCartDetails) => void;
  remove: (id: string) => void;
  clear: () => void;
  has: (id: string) => boolean;
  hydrated: boolean;
  /** Qiymət/mövcudluq bildirişləri (səbəti freshlenmiş qiymətlərlə yenilədikdən sonra). */
  priceNotices: CartPriceChange[];
  dismissPriceNotices: () => void;
  refreshPrices: () => Promise<void>;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "honsell.cart.v1";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [priceNotices, setPriceNotices] = useState<CartPriceChange[]>([]);

  // Hydrate from localStorage after mount to avoid SSR/client mismatch.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setItems(parsed);
      }
    } catch {
      // ignore corrupt cart state
    }
    setHydrated(true);
  }, []);

  const refreshPrices = useCallback(async () => {
    const snapshot = items;
    if (snapshot.length === 0) return;
    const ids = snapshot.map((i) => i.id);
    let data: { prices?: { id: string; finalAzn: number }[]; missing?: string[] } | null = null;
    try {
      const res = await fetch("/api/cart/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) return;
      data = await res.json();
    } catch {
      return;
    }
    if (!data) return;

    const priceMap = new Map<string, number>();
    for (const p of data.prices ?? []) {
      if (typeof p?.id === "string" && typeof p?.finalAzn === "number") {
        priceMap.set(p.id, p.finalAzn);
      }
    }
    const missing = new Set<string>(data.missing ?? []);
    const notices: CartPriceChange[] = [];

    setItems((prev) => {
      const next: CartItem[] = [];
      for (const it of prev) {
        if (missing.has(it.id)) {
          notices.push({ kind: "removed", id: it.id, title: it.title });
          continue;
        }
        const fresh = priceMap.get(it.id);
        if (typeof fresh === "number" && Math.abs(fresh - it.finalAzn) > 0.0049) {
          notices.push({
            kind: "price",
            id: it.id,
            title: it.title,
            oldAzn: it.finalAzn,
            newAzn: fresh,
          });
          next.push({ ...it, finalAzn: fresh });
        } else {
          next.push(it);
        }
      }
      return next;
    });

    if (notices.length > 0) {
      setPriceNotices((prev) => {
        const byId = new Map(prev.map((n) => [`${n.kind}:${n.id}`, n]));
        for (const n of notices) byId.set(`${n.kind}:${n.id}`, n);
        return Array.from(byId.values());
      });
    }
  }, [items]);

  // Səbət hydrate olduqda bir dəfə fresh qiymətləri serverdən gətir.
  // Endirim bitsə də səbətdə köhnə finalAzn qalmasın deyə.
  const didInitialRefresh = useRef(false);
  useEffect(() => {
    if (!hydrated) return;
    if (didInitialRefresh.current) return;
    if (items.length === 0) return;
    didInitialRefresh.current = true;
    void refreshPrices();
  }, [hydrated, items, refreshPrices]);

  const dismissPriceNotices = useCallback(() => setPriceNotices([]), []);

  // Persist on every change, but only after we've hydrated (otherwise we
  // overwrite the saved cart with the empty initial state).
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ignore quota errors
    }
  }, [items, hydrated]);

  const add = useCallback((item: Omit<CartItem, "qty">) => {
    setItems((prev) => {
      if (
        item.productType === "ACCOUNT_CREATION" ||
        item.productType === "STREAMING" ||
        item.productType === "PLATFORM"
      ) {
        const rest = prev.filter((i) => i.id !== item.id);
        return [...rest, { ...item, qty: 1 }];
      }
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        // Cash cards / addons can be bought in multiples; full games stay at 1.
        if (item.productType === "GAME" || item.productType === "PS_PLUS" || item.productType === "EA_PLAY") return prev;
        return prev.map((i) =>
          i.id === item.id ? { ...i, qty: i.qty + 1 } : i
        );
      }
      return [...prev, { ...item, qty: 1 }];
    });
  }, []);

  const setQty = useCallback((id: string, qty: number) => {
    setItems((prev) =>
      qty <= 0
        ? prev.filter((i) => i.id !== id)
        : prev.map((i) => (i.id === id ? { ...i, qty } : i))
    );
  }, []);

  const updateAccountCreation = useCallback((id: string, details: AccountCreationCartDetails) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === id && i.productType === "ACCOUNT_CREATION" ? { ...i, accountCreation: details } : i
      )
    );
  }, []);

  const updateStreaming = useCallback((id: string, details: StreamingCartDetails) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === id && (i.productType === "STREAMING" || i.productType === "PLATFORM")
          ? { ...i, streaming: details }
          : i
      )
    );
  }, []);

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const has = useCallback(
    (id: string) => items.some((i) => i.id === id),
    [items]
  );

  const value = useMemo<CartContextValue>(() => {
    const count = items.reduce((sum, i) => sum + i.qty, 0);
    const totalAzn = items.reduce((sum, i) => sum + i.qty * i.finalAzn, 0);
    return {
      items,
      count,
      totalAzn,
      add,
      setQty,
      updateAccountCreation,
      updateStreaming,
      remove,
      clear,
      has,
      hydrated,
      priceNotices,
      dismissPriceNotices,
      refreshPrices,
    };
  }, [
    items,
    add,
    setQty,
    updateAccountCreation,
    updateStreaming,
    remove,
    clear,
    has,
    hydrated,
    priceNotices,
    dismissPriceNotices,
    refreshPrices,
  ]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return ctx;
}
