"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useSession } from "./SessionProvider";
import { GiveawayCard, WinnersModal, type Giveaway } from "./GiveawayCard";

/**
 * Ana səhifə çəkiliş (giveaway) bölməsi.
 *
 * Data client-də `/api/giveaways`-dən gəlir ki, ana səhifə HTML-i statik/ISR
 * qalsın (user-vəziyyəti — qoşulub? eligible? — paint-dən sonra yüklənir).
 * Login deyilsə "Qoşul" düyməsi login səhifəsinə yönləndirir.
 *
 * Kart görünüşü `components/GiveawayCard`-da paylaşılır (arxiv səhifəsi də istifadə edir).
 */

export default function HomeGiveaways() {
  const { user, loading: sessionLoading } = useSession();
  const router = useRouter();
  const [giveaways, setGiveaways] = useState<Giveaway[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [winnersModal, setWinnersModal] = useState<Giveaway | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/giveaways")
      .then((r) => (r.ok ? r.json() : { giveaways: [] }))
      .then((d: { giveaways?: Giveaway[] }) => setGiveaways(d.giveaways ?? []))
      .catch(() => setGiveaways([]));
  }, []);

  // Sessiya yüklənəndən sonra oxu ki, joined/eligible vəziyyəti düz gəlsin.
  useEffect(() => {
    if (!sessionLoading) load();
  }, [sessionLoading, load]);

  const handleJoin = useCallback(
    async (g: Giveaway) => {
      if (!user) {
        router.push(`/login?next=${encodeURIComponent("/#cekilisler")}`);
        return;
      }
      setBusyId(g.id);
      setError(null);
      try {
        const res = await fetch(`/api/giveaways/${g.id}/join`, { method: "POST" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || "Qoşulmaq alınmadı.");
          if (data.joined) load();
          return;
        }
        setGiveaways((prev) =>
          (prev || []).map((x) =>
            x.id === g.id
              ? { ...x, joined: true, participantCount: data.participantCount ?? x.participantCount }
              : x
          )
        );
      } catch {
        setError("Şəbəkə xətası. Yenidən cəhd et.");
      } finally {
        setBusyId(null);
      }
    },
    [user, router, load]
  );

  // Heç bir aktiv/bitmiş çəkiliş yoxdursa bölməni tamamilə gizlət.
  if (giveaways !== null && giveaways.length === 0) return null;

  return (
    <section id="cekilisler" className="py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black uppercase tracking-tight text-zinc-950 dark:text-white sm:text-4xl">
              Çəkilişlər
            </h2>
            <p className="mt-1 text-sm font-bold uppercase tracking-[0.18em] text-zinc-400">
              Fürsətləri qaçırma
            </p>
          </div>
          <Link
            href="/cekilisler"
            className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 px-4 py-2 text-sm font-bold text-zinc-700 transition hover:border-violet-400 hover:text-violet-600 dark:border-white/15 dark:text-zinc-200 dark:hover:border-violet-400/50"
          >
            Keçmiş çəkilişlər <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-300">
            {error}
          </div>
        )}

        {giveaways === null ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-80 animate-pulse rounded-3xl border border-zinc-200 bg-zinc-100 dark:border-white/10 dark:bg-white/5"
              />
            ))}
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {giveaways.map((g) => (
              <GiveawayCard
                key={g.id}
                g={g}
                busy={busyId === g.id}
                onJoin={handleJoin}
                onShowWinners={setWinnersModal}
              />
            ))}
          </div>
        )}
      </div>

      {winnersModal && <WinnersModal g={winnersModal} onClose={() => setWinnersModal(null)} />}
    </section>
  );
}
