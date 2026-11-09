"use client";

import { CalendarDays } from "lucide-react";
import { useInstallmentOffer } from "@/components/useInstallmentOffer";
import InstallmentCardLogo from "@/components/InstallmentCardLogo";
import { cheapestMonthly, installmentAvailable } from "@/lib/installmentsShared";
import { cartServiceFeeCents } from "@/lib/cartServiceFee";

/**
 * Qiymətin altında "Taksitlə ayda 7.13 ₼-dan" — ən aşağı aylıq ödəniş, taksit
 * faizi və 3% xidmət haqqı DAXİL (ən uzun müddət həmişə ən ucuz aylıq deyil). Məhsul səhifəsi
 * statik qaldığı üçün təklif client-də yüklənir; taksit söndürülübsə və ya
 * qiymət minimumdan azdırsa heç nə göstərilmir (layout sürüşməsi olmur).
 */
export default function InstallmentHint({
  priceAzn,
  className = "",
  variant = "detail",
}: {
  priceAzn: number;
  className?: string;
  /** `card` — kataloq kartı üçün tək sətir, loqosuz (bütün kartlar bir sorğunu paylaşır). */
  variant?: "detail" | "card";
}) {
  const offer = useInstallmentOffer();
  // Səbətdə taksit faizi 3% xidmət haqqı daxil məbləğin üstünə gəlir
  // (lib/cartServiceFee.ts) — ipucu da eyni bazadan hesablanır.
  const priceCents = Math.round(priceAzn * 100);
  const payAzn = (priceCents + cartServiceFeeCents(priceCents)) / 100;
  if (!offer || !installmentAvailable(offer, payAzn)) return null;

  const best = cheapestMonthly(payAzn, offer.cards);
  if (!best) return null;

  if (variant === "card") {
    return (
      <p
        className={`inline-flex items-center gap-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-400 sm:text-xs ${className}`}
      >
        <CalendarDays className="h-3 w-3 shrink-0 text-violet-600 dark:text-violet-300 sm:h-3.5 sm:w-3.5" />
        <span>
          Taksitlə ayda{" "}
          <span className="font-bold tabular-nums text-zinc-900 dark:text-white">
            {best.monthlyAzn.toFixed(2)}₼
          </span>
          -dan
        </span>
      </p>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <p className="inline-flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
        <CalendarDays className="h-4 w-4 shrink-0 text-violet-600 dark:text-violet-300" />
        {/* Mətn tək elementdədir — flex `gap` "₼" ilə "-dan" arasına boşluq salmasın. */}
        <span>
          Taksitlə ayda{" "}
          <span className="font-semibold tabular-nums text-zinc-900 dark:text-white">
            {best.monthlyAzn.toFixed(2)} ₼
          </span>
          -dan ({best.months} ay)
        </span>
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        {offer.cards.map((card) => (
          <InstallmentCardLogo key={card.id} name={card.name} heightPx={14} />
        ))}
      </div>
    </div>
  );
}
