"use client";

import { createContext, useContext } from "react";

/**
 * PS Store kateqoriya referal faizləri (standart "Adi" seqment) — client
 * komponentlərə (GameCard, gift card, PS Plus, hesab açma) prop threading olmadan
 * çatdırmaq üçün. Streaming/platforma faizləri per-məhsul olduğundan onlar
 * birbaşa metadata.referralPct ilə ötürülür (context-ə ehtiyac yoxdur).
 *
 * Dəyər `Settings` mirror-undan gəlir (default seqmentin faizləri).
 */
export type ReferralCategoryRates = {
  games: number;
  psPlus: number;
  giftCards: number;
  accountCreation: number;
};

const DEFAULT: ReferralCategoryRates = {
  games: 0,
  psPlus: 0,
  giftCards: 0,
  accountCreation: 0,
};

const Ctx = createContext<ReferralCategoryRates>(DEFAULT);

export function ReferralRatesProvider({
  value,
  children,
}: {
  value: ReferralCategoryRates;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useReferralCategoryRates() {
  return useContext(Ctx);
}
