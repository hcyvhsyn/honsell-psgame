"use client";

import { useState } from "react";
import Link from "next/link";
import { Gift, Sparkles, Users } from "lucide-react";
import Modal from "./Modal";
import { useReferralCategoryRates, type ReferralCategoryRates } from "./ReferralRatesProvider";

type Props = {
  /** Açıq faiz (streaming/platforma — metadata.referralPct). */
  pct?: number;
  /** PS Store kateqoriyası — faiz context-dən oxunur. */
  category?: keyof ReferralCategoryRates;
  /** Modalda göstərilən məhsul adı (opsional). */
  productName?: string;
  /** Kart üstündə yerləşmə üçün əlavə class. */
  className?: string;
  /** Kompakt (yalnız ikon + faiz) yoxsa mətnli. */
  compact?: boolean;
};

function fmtPct(value: number) {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
}

export default function ReferralBadge({ pct, category, productName, className, compact }: Props) {
  const categoryRates = useReferralCategoryRates();
  const [open, setOpen] = useState(false);

  const effective = pct != null ? pct : category ? categoryRates[category] : 0;
  if (!Number.isFinite(effective) || effective <= 0) return null;
  const pctText = fmtPct(effective);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        title="Referal qazancı — ətraflı"
        className={`inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-700 transition hover:bg-emerald-500/20 dark:text-emerald-300 ${
          className ?? ""
        }`}
      >
        <Gift className="h-3 w-3" />
        {compact ? `${pctText}%` : `Referal ${pctText}%`}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} size="sm" closeOnBackdrop>
        <div className="p-6">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
              <Gift className="h-6 w-6" />
            </span>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Referal qazancı</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {productName ? productName : "Bu məhsul"} üçün referal faizi
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-center">
            <p className="text-sm text-emerald-700 dark:text-emerald-200">Sən qazanırsan</p>
            <p className="mt-1 text-4xl font-black tabular-nums text-emerald-700 dark:text-emerald-300">
              {pctText}%
            </p>
            <p className="mt-1 text-xs text-emerald-700/80 dark:text-emerald-200/80">
              satış məbləğindən
            </p>
          </div>

          <div className="mt-5 space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
            <div className="flex items-start gap-3">
              <Users className="mt-0.5 h-5 w-5 shrink-0 text-violet-500" />
              <p>
                Referal linkini paylaş. Dəvət etdiyin şəxs bu məhsulu alanda, satış məbləğinin{" "}
                <span className="font-bold text-zinc-900 dark:text-white">{pctText}%</span>-i sənin
                referal balansına yazılır.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
              <p>Balansı növbəti alışlarında istifadə edə bilərsən. Faiz məhsula görə dəyişir.</p>
            </div>
          </div>

          <Link
            href="/qazan"
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-violet-500"
          >
            Referal proqramı — ətraflı
          </Link>
        </div>
      </Modal>
    </>
  );
}
