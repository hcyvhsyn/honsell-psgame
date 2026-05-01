"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

/** Səbətdə PSN hesab açılışı üçün müştəri məlumatları (checkout zamanı serverə göndərilir). */
export type AccountCreationCartDetails = {
  fullName: string;
  birthDate: string;
  email: string;
  password: string;
};

export type CartItem = {
  id: string;
  title: string;
  imageUrl: string | null;
  finalAzn: number;
  productType: string;
  qty: number;
  accountCreation?: AccountCreationCartDetails;
};

type CartContextValue = {
  items: CartItem[];
  count: number;
  totalAzn: number;
  add: (item: Omit<CartItem, "qty">) => void;
  setQty: (id: string, qty: number) => void;
  updateAccountCreation: (id: string, details: AccountCreationCartDetails) => void;
  remove: (id: string) => void;
  clear: () => void;
  has: (id: string) => boolean;
  hydrated: boolean;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "honsell.cart.v1";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

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
      if (item.productType === "ACCOUNT_CREATION") {
        const rest = prev.filter((i) => i.id !== item.id);
        return [...rest, { ...item, qty: 1 }];
      }
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        // Cash cards / addons can be bought in multiples; full games stay at 1.
        if (item.productType === "GAME" || item.productType === "PS_PLUS") return prev;
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
      remove,
      clear,
      has,
      hydrated,
    };
  }, [items, add, setQty, updateAccountCreation, remove, clear, has, hydrated]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return ctx;
}
