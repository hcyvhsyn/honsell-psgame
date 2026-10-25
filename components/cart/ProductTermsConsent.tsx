"use client";

import { ShieldCheck } from "lucide-react";
import Modal from "@/components/Modal";
import type { CartItem } from "@/lib/cart";
import { getProductTerms, listProductTerms, type ProductTerms } from "@/lib/productTerms";
import { isSellableGameStore, isSellableServiceType } from "@/lib/storeScope";

/** Səbətdəki məhsullardan unikal (başlığa görə) xüsusi şərtləri toplayır. */
export function collectCartTerms(items: CartItem[]): ProductTerms[] {
  const byTitle = new Map<string, ProductTerms>();
  for (const it of items) {
    if (it.gift) continue; // hədiyyələr alıcıya çatdırılmır, şərt tətbiq olunmur
    const t = getProductTerms(it.productType, it.store, it.streaming?.platformKind);
    if (t && !byTitle.has(t.termsTitle)) byTitle.set(t.termsTitle, t);
  }
  return Array.from(byTitle.values());
}

/** Səbətdə qəbul tələb edən (requiresAcceptance) şərt varmı? */
export function cartNeedsTermsAcceptance(items: CartItem[]): boolean {
  return collectCartTerms(items).some((t) => t.requiresAcceptance);
}

// Şərtlər bir dəfə qəbul olunur və cihazda yadda qalır — səbətdə hər dəfə
// checkbox göstərilmir. Şərt mətni ciddi dəyişəndə versiyanı artır: hamı
// növbəti ödənişdə yenidən qəbul edər.
const CONSENT_LS_KEY = "honsell.productTermsAccepted.v1";

export function hasAcceptedProductTerms(): boolean {
  try {
    return window.localStorage.getItem(CONSENT_LS_KEY) != null;
  } catch {
    return false;
  }
}

export function storeProductTermsAcceptance() {
  try {
    window.localStorage.setItem(CONSENT_LS_KEY, new Date().toISOString());
  } catch {
    /* ignore — qəbul bu sessiya üçün CartView state-ində qalır */
  }
}

function isTermInScope(productType: string, store: string | null) {
  return productType === "GAME" ? isSellableGameStore(store) : isSellableServiceType(productType);
}

/** İlk ödəniş cəhdində açılan bir dəfəlik şərt qəbulu. */
export default function ProductTermsConsentModal({
  open,
  onAccept,
  onClose,
}: {
  open: boolean;
  onAccept: () => void;
  onClose: () => void;
}) {
  const terms = listProductTerms(isTermInScope);

  return (
    <Modal open={open} onClose={onClose} size="md">
      <div className="p-5 sm:p-6">
        <div className="flex items-center gap-2 pr-10">
          <ShieldCheck className="h-5 w-5 shrink-0 text-indigo-400" />
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Məhsul şərtləri</h2>
        </div>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Bir dəfə qəbul edirsən — növbəti alışlarda yenidən soruşulmayacaq.
        </p>

        <ul className="mt-4 space-y-3">
          {terms.map((t) => (
            <li key={t.termsTitle} className="text-sm leading-snug">
              <p className="font-semibold text-zinc-900 dark:text-zinc-100">{t.termsTitle}</p>
              <p className="mt-0.5 text-zinc-600 dark:text-zinc-400">{t.termsDescription}</p>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={onAccept}
          className="mt-6 flex w-full items-center justify-center rounded-xl bg-indigo-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 active:scale-[0.98]"
        >
          Qəbul edirəm və davam edirəm
        </button>
      </div>
    </Modal>
  );
}
