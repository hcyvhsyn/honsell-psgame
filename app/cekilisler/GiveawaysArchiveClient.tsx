"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/SessionProvider";
import { GiveawayCard, WinnersModal, type Giveaway } from "@/components/GiveawayCard";

/**
 * `/cekilisler` — bütün çəkilişlərin arxivi (aktiv + keçmiş).
 * Ana səhifədəki `HomeGiveaways` ilə eyni kartı istifadə edir, amma limitsiz
 * və status üzrə qruplaşdırılmış (Aktiv / Keçmiş).
 */
export default function GiveawaysArchiveClient() {
  const { user, loading: sessionLoading } = useSession();
  const router = useRouter();
  const [giveaways, setGiveaways] = useState<Giveaway[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [winnersModal, setWinnersModal] = useState<Giveaway | null>(null);
  const [error, setError] = useState<string | null>(null);





  
  const load = useCallback(() => {
    fetch("/api/giveaways?scope=all")
      .then((r) => (r.ok ? r.json() : { giveaways: [] }))
      .then((d: { giveaways?: Giveaway[] }) => setGiveaways(d.giveaways ?? []))
      .catch(() => setGiveaways([]));
  }, []);

  useEffect(() => {
    if (!sessionLoading) load();
  }, [sessionLoading, load]);

  const handleJoin = useCallback(
    async (g: Giveaway) => {
      if (!user) {
        router.push(`/login?next=${encodeURIComponent(`/cekilis/${g.id}?autojoin=1`)}`);
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

  const active = useMemo(
    () => (giveaways ?? []).filter((g) => g.status === "ACTIVE"),
    [giveaways]
  );
  const past = useMemo(
    () => (giveaways ?? []).filter((g) => g.status === "COMPLETED"),
    [giveaways]
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <header className="mb-8">
        <h1 className="text-3xl font-black uppercase tracking-tight text-zinc-950 dark:text-white sm:text-4xl">
          Çəkilişlər
        </h1>
        <p className="mt-1 text-sm font-bold uppercase tracking-[0.18em] text-zinc-400">
          Aktiv və keçmiş çəkilişlər
        </p>
      </header>

      {error && (
        <div className="mb-5 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-300">
          {error}
        </div>
      )}

      {giveaways === null ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-80 animate-pulse rounded-3xl border border-zinc-200 bg-zinc-100 dark:border-white/10 dark:bg-white/5"
            />
          ))}
        </div>
      ) : giveaways.length === 0 ? (
        <p className="py-16 text-center text-sm text-zinc-500">Hələ çəkiliş keçirilməyib.</p>
      ) : (
        <div className="space-y-12">
          {active.length > 0 && (
            <section>
              <h2 className="mb-5 flex items-center gap-2 text-lg font-black text-zinc-900 dark:text-white">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Aktiv çəkilişlər
                <span className="text-sm font-bold text-zinc-400">({active.length})</span>
              </h2>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {active.map((g) => (
                  <GiveawayCard
                    key={g.id}
                    g={g}
                    busy={busyId === g.id}
                    onJoin={handleJoin}
                    onShowWinners={setWinnersModal}
                  />
                ))}
              </div>
            </section>
          )}

          {past.length > 0 && (
            <section>
              <h2 className="mb-5 flex items-center gap-2 text-lg font-black text-zinc-900 dark:text-white">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-violet-500" />
                Keçmiş çəkilişlər
                <span className="text-sm font-bold text-zinc-400">({past.length})</span>
              </h2>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {past.map((g) => (
                  <GiveawayCard
                    key={g.id}
                    g={g}
                    busy={busyId === g.id}
                    onJoin={handleJoin}
                    onShowWinners={setWinnersModal}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {winnersModal && <WinnersModal g={winnersModal} onClose={() => setWinnersModal(null)} />}
    </div>
  );
}
