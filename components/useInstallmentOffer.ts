"use client";

import { useEffect, useState } from "react";
import { INSTALLMENT_DISABLED, type InstallmentOffer } from "@/lib/installmentsShared";

// Eyni sorğu qısa müddətdə bir dəfə gedir (məhsul səhifəsində bir neçə hint,
// səbətdə hər render təkrar fetch etməsin). Yalnız uğurlu cavab 5 dəqiqə
// saxlanılır: səhv və ya "söndürülüb" cavabı açıq tabda ilişib qalmamalıdır —
// əvvəl qalırdı və taksit env-də açılandan sonra da səhifə yenilənənə qədər
// görünmürdü.
const OFFER_TTL_MS = 5 * 60 * 1000;
const requests = new Map<string, { at: number; req: Promise<InstallmentOffer> }>();

function loadOffer(amountAzn?: number): Promise<InstallmentOffer> {
  const key = amountAzn != null ? amountAzn.toFixed(2) : "any";
  const hit = requests.get(key);
  if (hit && Date.now() - hit.at < OFFER_TTL_MS) return hit.req;

  const qs = amountAzn != null ? `?amount=${encodeURIComponent(amountAzn.toFixed(2))}` : "";
  const req = fetch(`/api/cart/installments${qs}`, { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<InstallmentOffer>) : INSTALLMENT_DISABLED))
    .catch(() => INSTALLMENT_DISABLED)
    .then((offer) => {
      if (!offer.enabled || offer.cards.length === 0) requests.delete(key);
      return offer;
    });
  requests.set(key, { at: Date.now(), req });
  return req;
}

/** Taksit təklifi; yüklənənə qədər `null`. `amountAzn` verilməsə ümumi təklif. */
export function useInstallmentOffer(amountAzn?: number): InstallmentOffer | null {
  const [offer, setOffer] = useState<InstallmentOffer | null>(null);
  const key = amountAzn != null ? amountAzn.toFixed(2) : "any";

  useEffect(() => {
    let cancelled = false;
    void loadOffer(amountAzn).then((o) => {
      if (!cancelled) setOffer(o);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return offer;
}
