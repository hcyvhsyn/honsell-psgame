"use client";

import { useSyncExternalStore } from "react";

/**
 * Bütün səhifə üçün TƏK saniyəlik taymer. Əvvəl hər geri sayan kart öz
 * `setInterval`-ını qururdu — kataloqda 24 kart = 24 ayrı taymer, hər biri öz
 * anında re-render. İndi bir taymer, bir tik, React yeniləmələri bir taskda
 * birləşdirir. Heç kim abunə deyilsə taymer dayanır.
 */
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let now = 0;

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      listeners.forEach((l) => l());
    }, 1000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

const noopSubscribe = () => () => {};
const getNow = () => now;
const getNull = () => null;

/** `enabled` olanda hər saniyə yenilənən `Date.now()`, əks halda `null`. */
export function useSecondTicker(enabled: boolean): number | null {
  return useSyncExternalStore(
    enabled ? subscribe : noopSubscribe,
    enabled ? getNow : getNull,
    getNull,
  );
}
