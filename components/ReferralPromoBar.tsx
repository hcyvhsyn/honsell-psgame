"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, X, Gift, ArrowRight, Check, Share2 } from "lucide-react";
import {
  buildReferralRegisterUrl,
  buildReferralShareMessage,
} from "@/lib/referralPromotion";

const STORAGE_KEY = "honsell.refbar.dismissed.v1";
const DISMISS_DAYS = 3;

export default function ReferralPromoBar({
  code,
  sharePct,
  earnedAzn,
}: {
  /** İstifadəçi loginli deyilsə bu null gəlir, generic CTA göstərilir. */
  code: string | null;
  sharePct: number;
  /** Toplam qazanılmış komissiya (loyalty üçün motivasiya). */
  earnedAzn?: number;
}) {
  const [hidden, setHidden] = useState(true);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setHidden(false);
        return;
      }
      const ts = Number(raw);
      if (!Number.isFinite(ts)) {
        setHidden(false);
        return;
      }
      const elapsed = Date.now() - ts;
      if (elapsed > DISMISS_DAYS * 24 * 60 * 60 * 1000) {
        setHidden(false);
      }
    } catch {
      setHidden(false);
    }
  }, []);

  if (hidden) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setHidden(true);
  }

  async function shareInvite() {
    if (!code) return;
    const url = buildReferralRegisterUrl(code);
    const text = buildReferralShareMessage(code, sharePct);
    // Web Share API (mobile) opens the OS share sheet; desktop falls back
    // to writing the link to clipboard.
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: "Dəvət linki", text, url });
        return;
      }
    } catch {
      // user cancelled or browser refused — fall through to clipboard.
    }
    try {
      await navigator.clipboard.writeText(url);
      setShared(true);
      setTimeout(() => setShared(false), 1800);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="relative overflow-hidden border-b border-fuchsia-500/20 bg-gradient-to-r from-fuchsia-700/30 via-purple-700/25 to-fuchsia-700/30">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(232,121,249,0.25),transparent_60%)]" />
      <div className="relative mx-auto flex max-w-7xl items-center gap-3 px-4 py-2 sm:px-6">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-fuchsia-500/25 ring-1 ring-fuchsia-400/40">
          <Sparkles className="h-4 w-4 text-fuchsia-200" />
        </div>

        <div className="min-w-0 flex-1">
          {code ? (
            <p className="truncate text-xs leading-tight text-fuchsia-50 sm:text-sm">
              <span className="font-semibold">Hər dəvətdən {sharePct}% qazan!</span>{" "}
              <span className="hidden sm:inline">Kodun:&nbsp;</span>
              <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[11px] font-bold tracking-wider text-white">
                {code}
              </code>
              {typeof earnedAzn === "number" && earnedAzn > 0 ? (
                <span className="ml-2 hidden rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-200 sm:inline">
                  Qazanc: {earnedAzn.toFixed(2)} AZN
                </span>
              ) : null}
            </p>
          ) : (
            <p className="truncate text-xs leading-tight text-fuchsia-50 sm:text-sm">
              <Gift className="mr-1 inline h-3.5 w-3.5" />
              <span className="font-semibold">Referal proqramı:</span>{" "}
              Qeydiyyatdan keç, kodunu paylaş və hər dəvətdən {sharePct}% qazan.
            </p>
          )}
        </div>

        {code ? (
          <button
            type="button"
            onClick={shareInvite}
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-bold text-fuchsia-900 transition hover:bg-fuchsia-50 sm:px-4 sm:py-1.5 sm:text-[13px]"
          >
            {shared ? (
              <>
                <Check className="h-3.5 w-3.5" />
                Kopyalandı
              </>
            ) : (
              <>
                <Share2 className="h-3.5 w-3.5" />
                Dəvət et
              </>
            )}
          </button>
        ) : (
          <Link
            href="/qazan"
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-bold text-fuchsia-900 transition hover:bg-fuchsia-50 sm:px-4 sm:py-1.5 sm:text-[13px]"
          >
            Detallı bax
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}

        <button
          type="button"
          onClick={dismiss}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-fuchsia-200 transition hover:bg-white/10 hover:text-white"
          aria-label="Banneri bağla"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
