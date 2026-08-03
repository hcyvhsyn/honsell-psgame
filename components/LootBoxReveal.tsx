"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Package, Sparkles } from "lucide-react";

import ProductImage from "./ProductImage";
import { formatAzn, PRIZE_TIER_LABELS, prizeTierFor, type PrizeTier } from "@/lib/lootBoxShared";

/**
 * Qutu açılışının bütün vizual mərhələləri bu komponentdə idarə olunur.
 *
 * Server nəticəni əvvəlcədən qaytarır; burada yalnız həmin nəticənin premium
 * formada təqdimatı var: gərginlik, qapağın açılması, rulet və tier effekti.
 */

export type RevealPrize = {
  gameId: string;
  title: string;
  imageUrl: string | null;
  valueAznCents: number;
};

type OpeningPhase = "charge" | "burst" | "spin";

const TIER_STYLES: Record<PrizeTier, { ring: string; glow: string; chip: string; resultClass: string }> = {
  COMMON: {
    ring: "ring-4 ring-slate-300 dark:ring-slate-600",
    glow: "shadow-2xl shadow-slate-400/30",
    chip: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
    resultClass: "tier-common",
  },
  STANDARD: {
    ring: "ring-4 ring-sky-400",
    glow: "shadow-2xl shadow-sky-400/40",
    chip: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
    resultClass: "tier-standard",
  },
  RARE: {
    ring: "ring-4 ring-violet-400",
    glow: "shadow-2xl shadow-violet-500/50",
    chip: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
    resultClass: "tier-rare",
  },
  LEGENDARY: {
    ring: "ring-4 ring-amber-400",
    glow: "shadow-2xl shadow-amber-400/60",
    chip: "bg-gradient-to-r from-amber-500 to-fuchsia-600 text-white",
    resultClass: "tier-legendary",
  },
};

const CARD_GAP = 12;
const CARD_INNER = 112; // px — kartın öz eni
const CARD_WIDTH = CARD_INNER + CARD_GAP; // lentdə bir addım
/**
 * Lent qazanan kartda BİTMİR — ondan sonra da kartlar var.
 *
 * Əvvəl qazanan kart lentin sonuncu elementi idi: rulet həmişə "sonda" dayanırdı
 * və müştəridə "nəticə əvvəlcədən sona qoyulub" şübhəsi yaranırdı. İndi qazanan
 * kart lentin ortasına yaxın dayanır, arxasınca daha 13 kart sürüşüb keçir.
 */
const WINNER_INDEX = 42;
const STRIP_LENGTH = 56;
/** Lent pəncərəsinin hündürlüyü — CSS uğursuz olsa belə şəkillər nəhəngləşməsin. */
const STRIP_HEIGHT = 146;
const CARD_IMAGE_HEIGHT = 92;
/** Qazanan kartın hansı nöqtəsində dayanacağı — hər dəfə bir az fərqli. */
const LANDING_JITTER = 34;

const PRELUDE_MS = 700;
const BURST_MS = 460;
const SPIN_MS = 4800;
/** Bulanıqlıq bu nisbətdə sönür — sonuncu kartlar aydın oxunsun. */
const BLUR_UNTIL = 0.55;
/** Nəticə kartı böyüyüb tam görünsün deyə seçim ekranı gecikdirilir. */
const RESULT_HOLD_MS = 1700;

const CONFETTI = [
  { left: "8%", top: "16%", color: "#fbbf24", delay: "0ms" },
  { left: "18%", top: "10%", color: "#f472b6", delay: "90ms" },
  { left: "29%", top: "6%", color: "#a78bfa", delay: "160ms" },
  { left: "71%", top: "8%", color: "#38bdf8", delay: "210ms" },
  { left: "82%", top: "14%", color: "#f59e0b", delay: "40ms" },
  { left: "91%", top: "27%", color: "#e879f9", delay: "130ms" },
  { left: "7%", top: "58%", color: "#60a5fa", delay: "260ms" },
  { left: "14%", top: "76%", color: "#facc15", delay: "180ms" },
  { left: "84%", top: "64%", color: "#fb7185", delay: "230ms" },
  { left: "92%", top: "80%", color: "#c084fc", delay: "70ms" },
];

/** Sabit "təsadüfilik" — eyni hədiyyə üçün eyni lent (hidrasiya uyğunsuzluğu olmasın). */
function seedFrom(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

export default function LootBoxReveal({
  prize,
  fillers,
  priceAznCents,
  onDone,
}: {
  prize: RevealPrize;
  /** Lenti doldurmaq üçün nümunə hədiyyələr (vizual). */
  fillers: RevealPrize[];
  priceAznCents: number;
  onDone: () => void;
}) {
  // Animasiya nə qədər gözəl olsa da, istifadəçi nə qazandığını bilmək
  // istəyəndə gözləməyə məcbur edilməməlidir — "Keç" onu dərhal nəticəyə atır.
  const [phase, setPhase] = useState<OpeningPhase>("charge");
  const [offset, setOffset] = useState(0);
  const [blurred, setBlurred] = useState(false);
  const [settled, setSettled] = useState(false);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  /**
   * Lent: qazanan kart `WINNER_INDEX`-dədir, amma lentin başqa yerlərində də
   * eyni oyun görünə bilər — belə olanda "göstərici duran kart yeganə fərqli
   * kartdır" təəssüratı tamamilə itir.
   */
  const strip = useMemo(() => {
    const pool = fillers.length > 0 ? fillers : [prize];
    const seed = seedFrom(prize.gameId);

    /*
      Qarışdırıb dövr edirik. Sadəcə sabit addımla (`i * 7`) getsəydik, hovuzdaki
      oyun sayı həmin addıma bölünəndə (məs. 14) lentdə cəmi 2 fərqli kart
      görünərdi. Permutasiya bu tələni tamamilə aradan qaldırır.
    */
    const ordered = [...pool];
    let rng = seed || 1;
    for (let i = ordered.length - 1; i > 0; i -= 1) {
      rng = (rng * 1664525 + 1013904223) % 4294967296;
      const j = rng % (i + 1);
      [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
    }

    const items: RevealPrize[] = [];
    for (let i = 0; i < STRIP_LENGTH; i += 1) {
      items.push(ordered[i % ordered.length]);
    }
    items[WINNER_INDEX] = prize;
    if (pool.length > 1) {
      // Eyni oyun lentdə başqa yerlərdə də olsun (vizual "yem").
      items[(seed % 9) + 4] = prize;
      items[(seed % 7) + 24] = prize;
    }
    return items;
  }, [fillers, prize]);

  useEffect(() => {
    let flashTimer: number | undefined;
    let blurTimer: number | undefined;
    let spinTimer: number | undefined;
    let doneTimer: number | undefined;
    let firstRaf: number | undefined;
    let secondRaf: number | undefined;
    let active = true;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const preludeMs = reducedMotion ? 80 : PRELUDE_MS;
    const flashMs = reducedMotion ? 120 : BURST_MS;
    const spinMs = reducedMotion ? 420 : SPIN_MS;

    const startSpin = () => {
      if (!active) return;
      setPhase("spin");
      if (!reducedMotion) setBlurred(true);

      // İki kadr gözləyirik ki, başlanğıc transform tətbiq olunsun və keçid işləsin.
      firstRaf = window.requestAnimationFrame(() => {
        secondRaf = window.requestAnimationFrame(() => {
          if (!active) return;
          // Dayanma nöqtəsi hər dəfə kartın bir az fərqli yerinə düşür — göstərici
          // heç vaxt riyazi olaraq eyni piksellə üst-üstə düşmür.
          const jitter = reducedMotion ? 0 : Math.round((Math.random() * 2 - 1) * LANDING_JITTER);
          setOffset(WINNER_INDEX * CARD_WIDTH + jitter);
        });
      });

      blurTimer = window.setTimeout(() => {
        if (active) setBlurred(false);
      }, spinMs * BLUR_UNTIL);

      spinTimer = window.setTimeout(() => {
        if (!active) return;
        setSettled(true);
        // Nəticə kartı düymələrdən əvvəl böyüyüb tam görünsün.
        doneTimer = window.setTimeout(() => {
          if (active) doneRef.current();
        }, reducedMotion ? 200 : RESULT_HOLD_MS);
      }, spinMs + 140);
    };

    const preludeTimer = window.setTimeout(() => {
      if (!active) return;
      setPhase("burst");
      flashTimer = window.setTimeout(startSpin, flashMs);
    }, preludeMs);

    return () => {
      active = false;
      if (preludeTimer != null) window.clearTimeout(preludeTimer);
      if (flashTimer != null) window.clearTimeout(flashTimer);
      if (blurTimer != null) window.clearTimeout(blurTimer);
      if (spinTimer != null) window.clearTimeout(spinTimer);
      if (doneTimer != null) window.clearTimeout(doneTimer);
      if (firstRaf != null) window.cancelAnimationFrame(firstRaf);
      if (secondRaf != null) window.cancelAnimationFrame(secondRaf);
    };
  }, []);

  const tier = prizeTierFor(prize.valueAznCents, priceAznCents);
  const styles = TIER_STYLES[tier];

  return (
    <div className="w-full min-w-0">
      <div className={`opening-stage opening-${phase}`} aria-hidden="true">
        <div className="opening-orbit opening-orbit-one" />
        <div className="opening-orbit opening-orbit-two" />
        <div className="opening-rays" />
        <div className="opening-beam" />
        <div className="opening-flash" />
        <div className="opening-box">
          <div className="opening-lid" />
          <div className="opening-box-body">
            <Package className="h-10 w-10 text-white/80" />
          </div>
        </div>
        <Sparkles className="opening-spark opening-spark-one h-4 w-4 text-amber-300" />
        <Sparkles className="opening-spark opening-spark-two h-3.5 w-3.5 text-fuchsia-300" />
      </div>

      <div
        className={`relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[#11101a] to-[#090910] py-5 sm:py-6 ${
          settled ? "strip-frame-settled" : ""
        }`}
      >
        {/* Mərkəz göstəricisi və kənar qaraltmaları lentin fokusunu qoruyur. */}
        <div className="pointer-events-none absolute inset-y-0 left-1/2 z-20 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-amber-300 to-transparent" />
        <div className="pointer-events-none absolute left-1/2 top-2 z-20 h-2 w-2 -translate-x-1/2 rotate-45 bg-amber-300 shadow-lg shadow-amber-400/50" />
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-[#090910] to-transparent sm:w-24" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-[#090910] to-transparent sm:w-24" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-white/[0.06] to-transparent" />
        {/* Sürət xətləri — bulanıqlıqla birlikdə "fırlanır" hissini gücləndirir. */}
        <div className={`loot-speed ${phase === "spin" && !settled ? "is-on" : ""}`} aria-hidden="true" />

        {/*
          Ölçülər QƏSDƏN inline stildədir, yalnız CSS sinfinə güvənmirik.
          Stil qatı hər hansı səbəbdən tətbiq olunmasa (styled-jsx sınsa,
          Tailwind sinfi build-ə düşməsə), lent şaquli yığılıb şəkilləri
          nəhəng göstərərdi. Inline stil bunu mümkünsüz edir.
        */}
        <div
          className="loot-strip-window"
          style={{
            height: STRIP_HEIGHT,
            overflow: "hidden",
            // Göstəricinin qazanan kartın üstünə düşməsi məhz bu boşluqdan asılıdır
            // — ona görə CSS sinfi ilə yanaşı inline də verilir.
            paddingLeft: `calc(50% - ${CARD_INNER / 2}px)`,
          }}
        >
          <div
            className={`loot-strip ${blurred ? "is-blurred" : ""} ${settled ? "is-settled" : ""}`}
            style={{
              display: "flex",
              gap: CARD_GAP,
              width: "max-content",
              height: STRIP_HEIGHT,
              transform: `translateX(-${offset}px)`,
            }}
          >
            {strip.map((item, i) => {
              const isWinner = i === WINNER_INDEX;
              return (
                <div
                  key={`${item.gameId}-${i}`}
                  style={{ flex: `0 0 ${CARD_INNER}px`, width: CARD_INNER, height: STRIP_HEIGHT }}
                  className={`loot-card ${
                    isWinner && settled
                      ? `${styles.ring} ${styles.glow} winner-card`
                      : "ring-1 ring-white/10"
                  }`}
                >
                  {/*
                    `position: relative` MƏCBURİDİR: ProductImage `next/image`-i
                    `fill` ilə render edir (position: absolute; inset: 0) və öz
                    konteynerini yaratmır. Relative olmasa şəkil ən yaxın
                    pozisiyalı ata elementə — modalın özünə — yapışır və bütün
                    mətni/düymələri örtür.
                  */}
                  <div
                    style={{ position: "relative", height: CARD_IMAGE_HEIGHT, overflow: "hidden" }}
                    className="w-full rounded-lg"
                  >
                    {item.imageUrl ? (
                      <ProductImage
                        src={item.imageUrl}
                        alt={item.title}
                        className="h-full w-full object-cover"
                        sizes="112px"
                      />
                    ) : (
                      // Şəkilsiz kart sınıq-şəkil ikonu kimi görünməməlidir —
                      // lentin ümumi görünüşünü tamamilə korlayır.
                      <div className="mystery-tile">
                        <Package className="h-8 w-8 text-white/70" />
                      </div>
                    )}
                  </div>
                  <div className="mt-1 truncate text-[11px] font-semibold text-white/80">{item.title}</div>
                  <div className="text-xs font-black text-amber-300">{formatAzn(item.valueAznCents)}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {settled && (
        <div className={`loot-result ${styles.resultClass}`} aria-live="polite">
          {tier === "LEGENDARY" && (
            <div className="pointer-events-none absolute inset-0" aria-hidden="true">
              {CONFETTI.map((piece, index) => (
                <span
                  key={`${piece.left}-${index}`}
                  className="loot-confetti"
                  style={{ left: piece.left, top: piece.top, backgroundColor: piece.color, animationDelay: piece.delay }}
                />
              ))}
            </div>
          )}
          <div className="loot-result-content">
            <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black ${styles.chip}`}>
              <Sparkles className="h-3.5 w-3.5" /> {PRIZE_TIER_LABELS[tier]}
            </span>

            {/* Hədiyyə ekranda böyüyür — açılışın kulminasiyası budur. */}
            <div className="prize-hero">
              <span className="prize-halo" aria-hidden="true" />
              <span className="prize-rays" aria-hidden="true" />
              <div className="prize-frame">
                {prize.imageUrl ? (
                  <ProductImage
                    src={prize.imageUrl}
                    alt={prize.title}
                    className="h-full w-full object-cover"
                    sizes="(max-width: 640px) 40vw, 176px"
                  />
                ) : (
                  <div className="mystery-tile">
                    <Package className="h-14 w-14 text-white/75" />
                  </div>
                )}
              </div>
            </div>

            <div className="prize-text mt-4 text-lg font-black leading-6 text-slate-900 dark:text-white sm:text-xl">
              {prize.title}
            </div>
            <div className="prize-value text-3xl font-black text-amber-500">
              {formatAzn(prize.valueAznCents)}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .opening-stage {
          position: relative;
          display: grid;
          height: 154px;
          place-items: center;
          overflow: hidden;
          border-radius: 24px;
          background: radial-gradient(circle at 50% 72%, rgba(217, 70, 239, 0.18), transparent 42%), linear-gradient(145deg, #171325, #0a0a11);
        }
        .opening-stage.opening-spin .opening-box {
          opacity: 0.5;
          transform: translateY(2px) scale(0.9);
        }
        .opening-orbit {
          position: absolute;
          border: 1px solid rgba(251, 191, 36, 0.34);
          border-radius: 999px;
          transform: rotate(-22deg);
          animation: opening-orbit-spin 9s linear infinite;
        }
        .opening-orbit-one { width: 174px; height: 74px; }
        .opening-orbit-two { width: 124px; height: 150px; border-color: rgba(217, 70, 239, 0.32); animation-direction: reverse; animation-duration: 7s; }
        .opening-rays {
          position: absolute;
          width: 210px;
          height: 210px;
          border-radius: 999px;
          background: conic-gradient(from 0deg, transparent, rgba(251, 191, 36, 0.15), transparent 12%, rgba(217, 70, 239, 0.14), transparent 26%, rgba(251, 191, 36, 0.12), transparent 44%);
          opacity: 0.7;
          animation: opening-rays-spin 12s linear infinite;
        }
        .opening-box {
          position: relative;
          z-index: 3;
          width: 86px;
          height: 76px;
          transform: translateY(0) scale(1);
          will-change: transform;
        }
        .opening-box-body {
          position: absolute;
          inset: 14px 0 0;
          display: grid;
          place-items: center;
          border: 1px solid rgba(255, 255, 255, 0.16);
          border-radius: 10px 10px 16px 16px;
          background: linear-gradient(145deg, #f59e0b, #c026d3 78%);
          box-shadow: 0 18px 34px rgba(217, 70, 239, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.35);
        }
        .opening-lid {
          position: absolute;
          top: 5px;
          left: -3px;
          z-index: 2;
          width: 92px;
          height: 24px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          background: linear-gradient(110deg, #fbbf24, #d946ef);
          transform-origin: 13% 100%;
          box-shadow: 0 7px 14px rgba(15, 10, 28, 0.35);
        }
        .opening-beam {
          position: absolute;
          bottom: 42px;
          z-index: 2;
          width: 72px;
          height: 108px;
          background: linear-gradient(to top, rgba(251, 191, 36, 0.52), rgba(255, 255, 255, 0.68), transparent);
          opacity: 0;
          transform: translateY(16px) scaleY(0.6);
          transform-origin: bottom;
          will-change: transform, opacity;
        }
        .opening-flash {
          position: absolute;
          inset: 0;
          z-index: 1;
          background: radial-gradient(circle at 50% 55%, rgba(255, 255, 255, 0.7), rgba(251, 191, 36, 0.15) 30%, transparent 65%);
          opacity: 0;
          pointer-events: none;
        }
        .opening-spark {
          position: absolute;
          z-index: 4;
          opacity: 0.7;
          animation: opening-spark-float 3.4s ease-in-out infinite;
          will-change: transform, opacity;
        }
        .opening-spark-one { margin-left: 126px; margin-top: -48px; }
        .opening-spark-two { margin-left: -130px; margin-top: 38px; animation-delay: -1.7s; }
        .opening-stage.opening-charge .opening-box { animation: opening-shake ${PRELUDE_MS}ms cubic-bezier(0.36, 0.07, 0.19, 0.97) both; }
        .opening-stage.opening-burst .opening-box { animation: opening-box-rise ${BURST_MS}ms cubic-bezier(0.2, 1.2, 0.4, 1) both; }
        .opening-stage.opening-burst .opening-lid { animation: opening-lid-open ${BURST_MS}ms cubic-bezier(0.2, 1.2, 0.4, 1) both; }
        .opening-stage.opening-burst .opening-beam { animation: opening-beam-rise ${BURST_MS}ms ease-out both; }
        .opening-stage.opening-burst .opening-flash { animation: opening-flash ${BURST_MS}ms ease-out both; }

        .strip-frame-settled {
          animation: strip-frame-punch 420ms cubic-bezier(0.2, 1.3, 0.4, 1) both;
        }
        .loot-speed {
          position: absolute;
          inset: 0;
          z-index: 15;
          opacity: 0;
          pointer-events: none;
          background: repeating-linear-gradient(
            90deg,
            rgba(255, 255, 255, 0) 0px,
            rgba(255, 255, 255, 0.05) 2px,
            rgba(255, 255, 255, 0) 6px
          );
          transition: opacity 420ms ease-out;
        }
        .loot-speed.is-on {
          opacity: 1;
          animation: loot-speed-slide 260ms linear infinite;
        }

        .loot-strip-window {
          width: 100%;
          max-width: 100%;
          overflow-x: hidden;
          overflow-y: hidden;
          /* Kartın MƏRKƏZİ göstərici xəttinə düşsün: boşluq deyil, kart eni. */
          padding-left: calc(50% - ${CARD_INNER / 2}px);
        }
        .loot-strip {
          display: flex;
          gap: ${CARD_GAP}px;
          width: max-content;
          will-change: transform;
          /* Yavaş start → sürət → çox uzun yavaşlama: ruletin əsl hissi budur. */
          transition: transform ${SPIN_MS}ms cubic-bezier(0.2, 0.04, 0.06, 1), filter 520ms ease-out;
        }
        .loot-strip.is-blurred {
          filter: blur(2.4px) saturate(1.15);
        }
        /* Nəticə anında qalan kartlar sönür, qazanan kart səhnəni tutur. */
        .loot-strip.is-settled .loot-card:not(.winner-card) {
          opacity: 0.28;
          filter: saturate(0.35);
        }
        .mystery-tile {
          display: grid;
          height: 100%;
          width: 100%;
          place-items: center;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: inherit;
          background: linear-gradient(145deg, rgba(245, 158, 11, 0.28), rgba(192, 38, 211, 0.3));
        }
        .loot-card {
          flex: 0 0 ${CARD_INNER}px;
          min-width: 0;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.055);
          padding: 8px;
          transition: opacity 420ms ease-out, filter 420ms ease-out;
        }
        .winner-card {
          position: relative;
          z-index: 5;
          animation: winner-pop 720ms cubic-bezier(0.2, 1.5, 0.35, 1) both;
        }
        .loot-result {
          position: relative;
          isolation: isolate;
          max-width: 28rem;
          margin: 16px auto 0;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 26px;
          padding: 20px 16px 22px;
          text-align: center;
          background: linear-gradient(145deg, rgba(255, 255, 255, 0.96), rgba(248, 247, 252, 0.92));
          animation: loot-result-in 640ms cubic-bezier(0.2, 1.2, 0.4, 1) both;
        }
        :global(html.dark) .loot-result {
          border-color: rgba(255, 255, 255, 0.12);
          background: linear-gradient(145deg, rgba(27, 24, 43, 0.98), rgba(15, 14, 25, 0.98));
        }
        .loot-result-content { position: relative; z-index: 2; }

        .prize-hero {
          position: relative;
          display: grid;
          place-items: center;
          margin: 14px auto 0;
          width: 100%;
          height: 224px;
        }
        .prize-halo {
          position: absolute;
          width: 232px;
          height: 232px;
          border-radius: 999px;
          background: radial-gradient(circle, rgba(251, 191, 36, 0.4), rgba(217, 70, 239, 0.16) 46%, transparent 68%);
          opacity: 0;
          transform: scale(0.5);
          animation: prize-halo-in 900ms cubic-bezier(0.2, 1.1, 0.4, 1) 120ms both;
        }
        .prize-rays {
          position: absolute;
          width: 264px;
          height: 264px;
          border-radius: 999px;
          background: conic-gradient(from 0deg, transparent, rgba(251, 191, 36, 0.22), transparent 14%, rgba(217, 70, 239, 0.2), transparent 30%, rgba(251, 191, 36, 0.18), transparent 48%);
          opacity: 0;
          animation: prize-rays-in 700ms ease-out 260ms both, opening-rays-spin 14s linear 260ms infinite;
        }
        .prize-frame {
          position: relative;
          z-index: 2;
          width: 152px;
          height: 204px;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.25);
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.1);
          box-shadow: 0 26px 60px -24px rgba(217, 70, 239, 0.75);
          /* "Ekranda böyümə": kiçikdən böyüyür, bir az aşır, sonra oturur. */
          animation: prize-zoom 860ms cubic-bezier(0.18, 1.35, 0.35, 1) both;
          will-change: transform, opacity;
        }
        .prize-text { animation: prize-text-in 520ms ease-out 420ms both; }
        .prize-value { animation: prize-value-in 620ms cubic-bezier(0.2, 1.4, 0.4, 1) 520ms both; }

        .tier-common { box-shadow: 0 20px 48px -30px rgba(100, 116, 139, 0.75); }
        .tier-common::before,
        .tier-standard::before,
        .tier-rare::before,
        .tier-legendary::before {
          position: absolute;
          inset: 9px;
          z-index: 0;
          border: 1px solid rgba(148, 163, 184, 0.45);
          border-radius: 20px;
          content: "";
          opacity: 0.8;
        }
        .tier-standard { box-shadow: 0 20px 52px -28px rgba(14, 165, 233, 0.8); }
        .tier-standard::before { border-color: rgba(56, 189, 248, 0.7); }
        .tier-rare { box-shadow: 0 20px 56px -26px rgba(139, 92, 246, 0.85); }
        .tier-rare::before { border-color: rgba(167, 139, 250, 0.75); }
        .tier-rare::after {
          position: absolute;
          inset: 20px;
          z-index: 0;
          border: 1px solid rgba(167, 139, 250, 0.55);
          border-radius: 22px;
          content: "";
          opacity: 0;
          transform: scale(0.78);
          animation: tier-wave 1100ms ease-out 120ms both;
        }
        .tier-legendary {
          background: linear-gradient(145deg, rgba(255, 251, 235, 0.98), rgba(253, 242, 248, 0.96));
          box-shadow: 0 24px 64px -26px rgba(245, 158, 11, 0.95);
        }
        :global(html.dark) .tier-legendary {
          background: linear-gradient(145deg, rgba(66, 45, 18, 0.98), rgba(55, 20, 55, 0.98));
        }
        .tier-legendary::before { border-color: rgba(245, 158, 11, 0.82); }
        .tier-legendary::after {
          position: absolute;
          inset: 0;
          z-index: 0;
          border-radius: inherit;
          background: radial-gradient(circle at 50% 38%, rgba(251, 191, 36, 0.38), transparent 56%);
          content: "";
          opacity: 0;
          transform: scale(0.7);
          animation: legendary-burst 850ms ease-out 80ms both;
        }
        .loot-confetti {
          position: absolute;
          z-index: 3;
          width: 7px;
          height: 13px;
          border-radius: 2px;
          opacity: 0;
          transform: translateY(-8px) rotate(-18deg);
          animation: confetti-pop 900ms cubic-bezier(0.2, 1.1, 0.4, 1) both;
        }

        @keyframes opening-orbit-spin { from { transform: rotate(-22deg); } to { transform: rotate(338deg); } }
        @keyframes opening-rays-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes loot-speed-slide {
          from { background-position-x: 0px; }
          to { background-position-x: -24px; }
        }
        @keyframes opening-shake {
          0%, 100% { transform: translateX(0) rotate(0deg); }
          18% { transform: translateX(-5px) rotate(-3deg); }
          36% { transform: translateX(5px) rotate(3deg); }
          54% { transform: translateX(-4px) rotate(-2deg); }
          72% { transform: translateX(3px) rotate(2deg); }
        }
        @keyframes opening-box-rise {
          from { transform: translateY(0) scale(1); }
          to { transform: translateY(4px) scale(0.96); }
        }
        @keyframes opening-lid-open {
          from { transform: rotate(0deg) translateY(0); }
          to { transform: rotate(-25deg) translate(-7px, -12px); }
        }
        @keyframes opening-beam-rise {
          from { opacity: 0; transform: translateY(16px) scaleY(0.6); }
          55% { opacity: 0.9; }
          to { opacity: 0.45; transform: translateY(0) scaleY(1); }
        }
        @keyframes opening-flash {
          0%, 100% { opacity: 0; }
          35% { opacity: 1; }
        }
        @keyframes opening-spark-float {
          0%, 100% { opacity: 0.3; transform: translateY(3px) scale(0.8); }
          50% { opacity: 0.95; transform: translateY(-8px) scale(1); }
        }
        @keyframes strip-frame-punch {
          0% { transform: scale(1); }
          45% { transform: scale(1.018); }
          100% { transform: scale(1); }
        }
        @keyframes winner-pop {
          0% { transform: scale(0.96) translateY(0); }
          45% { transform: scale(1.16) translateY(-6px); }
          100% { transform: scale(1.09) translateY(-3px); }
        }
        @keyframes loot-result-in {
          from { opacity: 0; transform: translateY(12px) scale(0.92); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes prize-zoom {
          0% { opacity: 0; transform: scale(0.34) translateY(26px); }
          55% { opacity: 1; transform: scale(1.12) translateY(-4px); }
          78% { transform: scale(0.97) translateY(0); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes prize-halo-in {
          0% { opacity: 0; transform: scale(0.5); }
          55% { opacity: 1; transform: scale(1.06); }
          100% { opacity: 0.75; transform: scale(1); }
        }
        @keyframes prize-rays-in {
          from { opacity: 0; }
          to { opacity: 0.85; }
        }
        @keyframes prize-text-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes prize-value-in {
          0% { opacity: 0; transform: scale(0.7); }
          60% { opacity: 1; transform: scale(1.14); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes tier-wave {
          0% { opacity: 0.8; transform: scale(0.78); }
          100% { opacity: 0; transform: scale(1.08); }
        }
        @keyframes legendary-burst {
          0% { opacity: 0; transform: scale(0.7); }
          45% { opacity: 0.8; transform: scale(1.08); }
          100% { opacity: 0.32; transform: scale(1); }
        }
        @keyframes confetti-pop {
          0% { opacity: 0; transform: translateY(-8px) rotate(-18deg) scale(0.7); }
          45% { opacity: 1; transform: translateY(4px) rotate(22deg) scale(1); }
          100% { opacity: 0.4; transform: translateY(18px) rotate(34deg) scale(0.86); }
        }
        @media (prefers-reduced-motion: reduce) {
          .opening-orbit,
          .opening-rays,
          .opening-spark,
          .opening-stage.opening-charge .opening-box,
          .opening-stage.opening-burst .opening-box,
          .opening-stage.opening-burst .opening-lid,
          .opening-stage.opening-burst .opening-beam,
          .opening-stage.opening-burst .opening-flash,
          .strip-frame-settled,
          .loot-speed.is-on,
          .winner-card,
          .loot-result,
          .prize-frame,
          .prize-halo,
          .prize-rays,
          .prize-text,
          .prize-value,
          .tier-rare::after,
          .tier-legendary::after,
          .loot-confetti {
            animation: none;
          }
          .opening-stage.opening-burst .opening-lid { transform: rotate(-22deg) translate(-6px, -10px); }
          .opening-stage.opening-burst .opening-beam { opacity: 0.65; transform: scaleY(1); }
          .opening-stage.opening-burst .opening-flash { opacity: 0.28; }
          .loot-result { opacity: 1; transform: none; }
          .loot-confetti { opacity: 0.45; transform: none; }
          .loot-strip { transition-duration: 400ms; }
          .loot-strip.is-blurred { filter: none; }
          .loot-speed { opacity: 0; }
          .prize-halo { opacity: 0.6; transform: none; }
          .prize-rays { opacity: 0.5; }
          .prize-frame { opacity: 1; transform: none; }
        }
      `}</style>
    </div>
  );
}
