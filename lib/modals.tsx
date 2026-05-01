"use client";

import { createContext, useCallback, useContext, useState } from "react";

type ModalKind = "login" | "register" | "forgot" | "cart" | "review";

type ModalCtx = {
  active: ModalKind | null;
  open: (m: ModalKind) => void;
  close: () => void;
};

const Ctx = createContext<ModalCtx>({
  active: null,
  open: () => {},
  close: () => {},
});

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<ModalKind | null>(null);
  const open = useCallback((m: ModalKind) => setActive(m), []);
  const close = useCallback(() => setActive(null), []);
  return <Ctx.Provider value={{ active, open, close }}>{children}</Ctx.Provider>;
}

export function useModals() {
  return useContext(Ctx);
}
