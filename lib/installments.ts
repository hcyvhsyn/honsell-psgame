import { fetchEpointInstallmentOptions, getEpointConfig } from "@/lib/epoint";
import {
  INSTALLMENT_DISABLED,
  parseInstallmentCards,
  withInstallmentFees,
  type InstallmentOffer,
} from "@/lib/installmentsShared";
import { installmentFeePct } from "@/lib/installmentRates";

/**
 * Taksit təklifi — Epoint `get-installment-request` + yaddaş keşi.
 *
 * Açma/bağlama runtime env ilə olur (rebuild lazım deyil):
 *   EPOINT_INSTALLMENT_ENABLED=1   — Epoint hesabında taksit aktiv ediləndən SONRA
 *   EPOINT_INSTALLMENT_MIN_AZN=50  — bundan aşağı məbləğdə taksit göstərilmir
 *
 * Komissiya müştəriyə yansıdılır: hər müddətin faizi lib/installmentRates.ts-dən
 * gəlir, qiymət `installmentChargeCents` ilə hesablanır (dəqiq örtük).
 */

const DEFAULT_MIN_AZN = 50;
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 200;

const cache = new Map<string, { at: number; offer: InstallmentOffer }>();

export function installmentConfig() {
  const enabled = process.env.EPOINT_INSTALLMENT_ENABLED?.trim() === "1";
  const rawMin = Number(process.env.EPOINT_INSTALLMENT_MIN_AZN);
  const minAzn = Number.isFinite(rawMin) && rawMin > 0 ? rawMin : DEFAULT_MIN_AZN;
  return { enabled, minAzn };
}

/**
 * `amountAzn` verilməsə ümumi təklif (məhsul səhifəsindəki "ayda X ₼-dan"
 * sətri üçün) qaytarılır. Epoint sorğusu uğursuz olsa taksit sadəcə
 * göstərilmir — ödənişin qalan yollarını bloklamamalıdır.
 */
export async function getInstallmentOffer(amountAzn?: number): Promise<InstallmentOffer> {
  const { enabled, minAzn } = installmentConfig();
  const epoint = getEpointConfig();
  if (!enabled || !epoint) return INSTALLMENT_DISABLED;

  const key = amountAzn != null ? amountAzn.toFixed(2) : "any";
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.offer;

  let offer: InstallmentOffer;
  try {
    const res = await fetchEpointInstallmentOptions({
      publicKey: epoint.publicKey,
      privateKey: epoint.privateKey,
      amountAzn,
    });
    if (!res.ok) {
      console.error("[installments] options failed", res.message);
      return { enabled: true, minAzn, cards: [] };
    }
    offer = {
      enabled: true,
      minAzn,
      cards: withInstallmentFees(parseInstallmentCards(res.rows), installmentFeePct),
    };
  } catch (err) {
    console.error("[installments] options error", err);
    return { enabled: true, minAzn, cards: [] };
  }

  if (cache.size >= CACHE_MAX_ENTRIES) cache.clear();
  cache.set(key, { at: Date.now(), offer });
  return offer;
}
