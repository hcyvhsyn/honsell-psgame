"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Loader2, Package, ShieldCheck, Sparkles, Wallet } from "lucide-react";

import LootBoxCard, { type LootBoxCardData } from "./LootBoxCard";
import LootBoxPrizeModal, { type OpenedPrize } from "./LootBoxPrizeModal";
import type { RevealPrize } from "./LootBoxReveal";
import Modal from "./Modal";
import { useSession } from "./SessionProvider";

type OpenResponse = {
  openingId?: string;
  orderCode?: string;
  pricePaidCents?: number;
  sellBackCents?: number;
  walletBalanceAfter?: number;
  prize?: OpenedPrize["prize"];
  error?: string;
  code?: string;
};

type OpenError = {
  title: string;
  message: string;
  action?: { href: string; label: string };
};

/**
 * Rulet lentinin kartları.
 *
 * Birinci mənbə hovuzdaki REAL oyunlardır (`box.showcase`) — əvvəl lent qutunun
 * öz adı/şəkli ilə doldurulurdu və eyni "100 azn qutu" kartı təkrarlanırdı.
 * Showcase boşdursa (hovuz hələ yaradılmayıb) ehtimal cədvəlinə geri düşürük.
 */
function buildRevealFillers(boxes: LootBoxCardData[], activeBox: LootBoxCardData): RevealPrize[] {
  const orderedBoxes = [activeBox, ...boxes.filter((box) => box.slug !== activeBox.slug)];

  const real = orderedBoxes.flatMap((box) =>
    (box.showcase ?? []).map((item) => ({
      gameId: `${box.slug}-${item.gameId}`,
      title: item.title,
      imageUrl: item.imageUrl,
      valueAznCents: item.valueAznCents,
    })),
  );
  if (real.length > 0) return real.slice(0, 20);

  /*
    Hovuz hələ yaradılmayıbsa real oyun adı yoxdur. Belə halda QUTUNUN adını
    yazmaq olmaz — lentdə "100 azn qutu" kartları təkrarlanır və müştəri nə
    qazana biləcəyini anlamır. Bunun əvəzinə "Sürpriz oyun" kartı göstərilir;
    `imageUrl: null` isə lentdə sınıq şəkil yox, hədiyyə plitəsi kimi görünür.
  */
  const fillers = orderedBoxes.flatMap((box) => {
    if (box.odds.length === 0) {
      return [{
        gameId: `${box.slug}-max-prize`,
        title: "Sürpriz oyun",
        imageUrl: null,
        valueAznCents: box.maxPrizeCents,
      }];
    }

    return box.odds.map((odd, index) => ({
      gameId: `${box.slug}-${odd.valueAznCents}-${index}`,
      title: "Sürpriz oyun",
      imageUrl: null,
      valueAznCents: odd.valueAznCents,
    }));
  });

  return fillers.length > 0 ? fillers.slice(0, 12) : [{
    gameId: activeBox.slug,
    title: "Sürpriz oyun",
    imageUrl: null,
    valueAznCents: activeBox.maxPrizeCents,
  }];
}

function errorTitle(status: number, code?: string): string {
  // Kod varsa ondan gedirik: 409 həm "bilet bitdi", həm "bu müştəri üçün yeni
  // oyun qalmadı" deməkdir və ikisi tamamilə fərqli mesaj tələb edir.
  if (code === "NO_NEW_PRIZES") return "Hamısını qazanmısınız";
  if (code === "NO_TICKETS") return "Qutu artıq bitib";
  if (status === 402) return "Balans kifayət etmir";
  if (status === 409) return "Qutu artıq bitib";
  if (status === 429) return "Gündəlik limit tamamlanıb";
  return "Qutu açıla bilmədi";
}

/**
 * Ana səhifə "Qutu açılışı" bölməsi.
 *
 * Data və istifadəçi əməliyyatı client-dədir ki, ana səhifə statik/ISR qalsın.
 * Qutu kartı artıq detail route-a keçmir — açılış bu komponentdəki modalda başlayır.
 */
export default function HomeLootBoxes() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession();
  const [boxes, setBoxes] = useState<LootBoxCardData[] | null>(null);
  const [hasEntered, setHasEntered] = useState(false);
  const [activeBox, setActiveBox] = useState<LootBoxCardData | null>(null);
  const [opened, setOpened] = useState<OpenedPrize | null>(null);
  const [openingSlug, setOpeningSlug] = useState<string | null>(null);
  const [openError, setOpenError] = useState<OpenError | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const requestRef = useRef(0);

  useEffect(() => {
    // `no-store`: brauzer köhnə cavabı saxlasa lent yenə qutu adları ilə dolar.
    fetch("/api/loot-boxes", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { boxes: [] }))
      .then((d: { boxes?: LootBoxCardData[] }) => setBoxes(d.boxes ?? []))
      .catch(() => setBoxes([]));
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    if (!("IntersectionObserver" in window)) {
      setHasEntered(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setHasEntered(true);
        observer.disconnect();
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px" },
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  const fillers = useMemo(
    () => (boxes && activeBox ? buildRevealFillers(boxes, activeBox) : []),
    [activeBox, boxes],
  );

  function closeOpening() {
    requestRef.current += 1;
    setOpeningSlug(null);
    setOpened(null);
    setActiveBox(null);
  }

  async function openBox(box: LootBoxCardData) {
    if (sessionLoading || openingSlug) return;

    if (!user) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setActiveBox(box);
    setOpened(null);
    setOpenError(null);
    setOpeningSlug(box.slug);

    try {
      const res = await fetch(`/api/loot-boxes/${box.slug}/open`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as OpenResponse;

      if (!res.ok) {
        if (res.status === 401) {
          router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
          return;
        }
        if (requestRef.current !== requestId) return;
        setActiveBox(null);
        setOpenError({
          title: errorTitle(res.status, data.code),
          message: data.error ?? `Qutu açıla bilmədi (HTTP ${res.status}).`,
          action: res.status === 402 ? { href: "/profile/wallet", label: "Balans yüklə" } : undefined,
        });
        return;
      }

      if (!data.openingId || !data.prize || data.pricePaidCents == null || data.sellBackCents == null) {
        throw new Error("Qutu açılışının nəticəsi natamamdır.");
      }
      if (requestRef.current !== requestId) return;

      setOpened({
        openingId: data.openingId,
        orderCode: data.orderCode ?? "",
        prize: data.prize,
        sellBackCents: data.sellBackCents,
        pricePaidCents: data.pricePaidCents,
      });
    } catch (err) {
      if (requestRef.current !== requestId) return;
      setActiveBox(null);
      setOpenError({
        title: "Qutu açıla bilmədi",
        message: (err as Error).message,
        action: undefined,
      });
    } finally {
      if (requestRef.current === requestId) setOpeningSlug(null);
    }
  }

  if (boxes != null && boxes.length === 0) return null;

  return (
    <>
      <section
        ref={sectionRef}
        className="relative isolate overflow-hidden border-y border-amber-200/60 bg-gradient-to-br from-amber-50/80 via-white to-fuchsia-50/70 py-12 dark:border-white/10 dark:from-[#160f1e] dark:via-[#0c0d17] dark:to-[#170d21]"
      >
        <div aria-hidden className="pointer-events-none absolute -left-28 top-0 h-72 w-72 rounded-full bg-amber-300/10" />
        <div aria-hidden className="pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-fuchsia-400/10" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-300/60 bg-white/70 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-amber-700 dark:border-amber-300/20 dark:bg-white/[0.06] dark:text-amber-300">
                <Sparkles className="h-3.5 w-3.5" /> Şansını sına
              </div>
              <h2 className="flex items-center gap-2 text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-amber-400 to-fuchsia-600 text-white shadow-lg shadow-fuchsia-500/20">
                  <Package className="h-5 w-5" />
                </span>
                Qutu açılışı
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-400">
                Qutunu aç, dəyəri yüksək rəqəmsal oyun qazan. Bütün şanslar açıq göstərilir və istəməsən hədiyyəni balansa sata bilərsən.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-bold text-slate-600 dark:text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" /> Şəffaf ehtimallar
                </span>
                <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                <span className="inline-flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-fuchsia-500" /> Ani rəqəmsal hədiyyə
                </span>
              </div>
            </div>
            <Link
              href="/qutular"
              className="inline-flex shrink-0 items-center gap-1 self-start rounded-full border border-slate-300 bg-white/80 px-4 py-2 text-sm font-bold text-slate-700 transition-transform hover:-translate-y-0.5 hover:border-fuchsia-300 dark:border-slate-700 dark:bg-white/[0.06] dark:text-slate-200 dark:hover:border-fuchsia-400/50 sm:self-auto"
            >
              Hamısı <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {boxes == null ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Qutular yüklənir">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-[22rem] animate-pulse rounded-3xl border border-white/70 bg-white/70 dark:border-white/10 dark:bg-white/[0.06]" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {boxes.slice(0, 4).map((box, index) => (
                <LootBoxCard
                  key={box.slug}
                  box={box}
                  index={index}
                  isVisible={hasEntered}
                  isOpening={openingSlug === box.slug}
                  onOpen={() => void openBox(box)}
                />
              ))}
            </div>
          )}
        </div>

        <style jsx>{`
          @media (prefers-reduced-motion: reduce) {
            :global(.loot-card-shell) {
              opacity: 1;
            }
          }
        `}</style>
      </section>

      {openingSlug && activeBox && (
        <Modal open onClose={closeOpening} size="sm">
          <div className="relative overflow-hidden p-7 text-center">
            <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-fuchsia-400/10" />
            <div className="relative mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-amber-400 to-fuchsia-600 text-white shadow-lg shadow-fuchsia-500/25">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
            <h2 className="relative mt-4 text-xl font-black text-slate-900 dark:text-white">Qutu hazırlanır…</h2>
            <p className="relative mt-2 text-sm text-slate-600 dark:text-slate-400">
              {activeBox.title} üçün şansın seçilir. Bir az gözlə.
            </p>
          </div>
        </Modal>
      )}

      <LootBoxPrizeModal
        opened={opened}
        fillers={fillers}
        onClose={closeOpening}
        onResolved={() => undefined}
        // `openBox` özü `opened`-i sıfırlayır → modal bağlanır, yükləmə ekranı
        // görünür, sonra yeni hədiyyə ilə təzədən açılır.
        onOpenAgain={activeBox ? () => void openBox(activeBox) : undefined}
      />

      {openError && (
        <Modal open onClose={() => setOpenError(null)} size="sm">
          <div className="relative overflow-hidden p-7 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose-500/10 text-rose-500 dark:bg-rose-400/10 dark:text-rose-300">
              <AlertCircle className="h-7 w-7" />
            </div>
            <h2 className="mt-4 text-xl font-black text-slate-900 dark:text-white">{openError.title}</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{openError.message}</p>
            <div className="mt-5 flex flex-col gap-2">
              {openError.action && (
                <Link
                  href={openError.action.href}
                  onClick={() => setOpenError(null)}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-500 to-fuchsia-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-transform hover:-translate-y-0.5"
                >
                  <Wallet className="h-4 w-4" /> {openError.action.label}
                </Link>
              )}
              <button
                type="button"
                onClick={() => setOpenError(null)}
                className="rounded-full border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 dark:border-slate-600 dark:text-slate-200"
              >
                Bağla
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
