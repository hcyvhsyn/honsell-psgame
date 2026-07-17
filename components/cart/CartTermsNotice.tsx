"use client";

import { useMemo, useState } from "react";
import { AlertCircle, ChevronDown } from "lucide-react";
import type { CartItem } from "@/lib/cart";
import { getProductTerms, type ProductTerms } from "@/lib/productTerms";

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

export default function CartTermsNotice({
  items,
  accepted,
  onAcceptedChange,
}: {
  items: CartItem[];
  accepted: boolean;
  onAcceptedChange: (v: boolean) => void;
}) {
  const terms = collectCartTerms(items);
  const hasMultipleTerms = terms.length > 1;
  const [expanded, setExpanded] = useState(false);
  const needsAcceptance = terms.some((t) => t.requiresAcceptance);
  const previewText = useMemo(() => {
    if (terms.length === 0) return "";
    if (hasMultipleTerms) return `${terms.length} şərt var`;
    return `${terms[0].termsTitle}: ${terms[0].termsDescription}`;
  }, [hasMultipleTerms, terms]);
  if (terms.length === 0) return null;

  return (
    <div className="rounded-xl border border-sky-500/25 bg-sky-500/[0.06] px-3 py-2.5">
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-300">
                Məhsul şərtləri
              </p>
              <p className="mt-1 text-[11px] leading-snug text-sky-100/90">
                {previewText}
              </p>
            </div>

            {hasMultipleTerms ? (
              <button
                type="button"
                onClick={() => setExpanded((prev) => !prev)}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-sky-500/25 px-2 py-1 text-[10px] font-semibold text-sky-200 transition hover:bg-sky-500/10"
              >
                {expanded ? "Gizlət" : "Hamısı"}
                <ChevronDown
                  className={`h-3 w-3 transition ${expanded ? "rotate-180" : ""}`}
                />
              </button>
            ) : null}
          </div>

          {hasMultipleTerms && expanded ? (
            <ul className="space-y-1.5">
              {terms.map((t) => (
                <li key={t.termsTitle} className="text-[11px] leading-snug text-sky-100/90">
                  <span className="font-semibold text-sky-200">{t.termsTitle}:</span>{" "}
                  {t.termsDescription}
                </li>
              ))}
            </ul>
          ) : null}

          {needsAcceptance && (
            <label className="flex cursor-pointer items-start gap-2 pt-1 text-xs text-sky-100">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => onAcceptedChange(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-sky-500/40 bg-transparent accent-indigo-500"
              />
              <span className="leading-snug">
                Seçdiyim məhsulların şərtlərini oxudum və qəbul edirəm.
              </span>
            </label>
          )}
        </div>
      </div>
    </div>
  );
}
