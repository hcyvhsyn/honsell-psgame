"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Gift,
  Users,
  Trophy,
  CheckCircle2,
  Crown,
  Flame,
  X,
  Clock,
  Loader2,
} from "lucide-react";
import { useSession } from "./SessionProvider";

/**
 * Ana səhifə çəkiliş (giveaway) bölməsi.
 *
 * Data client-də `/api/giveaways`-dən gəlir ki, ana səhifə HTML-i statik/ISR
 * qalsın (user-vəziyyəti — qoşulub? eligible? — paint-dən sonra yüklənir).
 * Login deyilsə "Qoşul" düyməsi login səhifəsinə yönləndirir.
 */

type Giveaway = {
  id: string;
  title: string;
  description: string | null;
  prizeLabel: string;
  prizeImageUrl: string | null;
  status: "ACTIVE" | "COMPLETED";
  winnersCount: number;
  entryCondition: string;
  conditionType: string | null;
  isVip: boolean;
  participantCount: number;
  endAt: string;
  drawnAt: string | null;
  joined: boolean;
  eligible: boolean;
  winners: string[];
};

const ENTRY_HINT: Record<string, string> = {
  REGISTER_ONLY: "Qoşulmaq üçün sadəcə hesabınla daxil ol.",
  PURCHASE_ANY: "Qoşulmaq üçün ən azı bir alışın olmalıdır.",
  PURCHASE_PRODUCT: "Qoşulmaq üçün müvafiq məhsulu almalısan.",
};

function useCountdown(endIso: string): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const diff = new Date(endIso).getTime() - now;
  if (diff <= 0) return "Bitdi";
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  if (d > 0) return `${d}g ${h}s ${m}d`;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatEndDate(iso: string): string {
  return new Date(iso).toLocaleDateString("az-AZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function GiveawayCard({
  g,
  onJoin,
  onShowWinners,
  busy,
}: {
  g: Giveaway;
  onJoin: (g: Giveaway) => void;
  onShowWinners: (g: Giveaway) => void;
  busy: boolean;
}) {
  const countdown = useCountdown(g.endAt);
  const completed = g.status === "COMPLETED";

  return (
    <div className="flex flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-[0_24px_60px_-40px_rgba(76,29,149,0.5)] dark:border-white/10 dark:bg-white/[0.03]">
      {/* Gradient başlıq */}
      <div className="relative bg-gradient-to-br from-violet-600 via-violet-600 to-indigo-600 p-6 pb-5">
        <div className="absolute right-4 top-4 flex flex-col items-end gap-2">
          {completed && (
            <span className="rounded-full bg-white/25 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-white backdrop-blur">
              Tamamlandı
            </span>
          )}
          {g.isVip && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-white backdrop-blur">
              <Crown className="h-3 w-3" /> VIP
            </span>
          )}
        </div>
        <h3 className="max-w-[80%] text-lg font-black leading-snug text-white sm:text-xl">
          {g.title}
        </h3>
        <div className="mt-5 flex items-center gap-2 text-white/90">
          <Gift className="h-4 w-4" />
          <span className="text-sm font-bold">{g.prizeLabel}</span>
        </div>
      </div>

      {/* Gövdə */}
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
          <Users className="h-4 w-4 text-violet-500" />
          <span className="font-bold text-zinc-900 dark:text-white">{g.participantCount}</span>
          <span>Katılımcı</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
          <Trophy className="h-4 w-4 text-violet-500" />
          <span className="font-bold text-zinc-900 dark:text-white">{g.winnersCount}</span>
          <span>Qazanan</span>
        </div>

        <div className="mt-1 flex items-center gap-2 rounded-xl bg-zinc-50 px-3 py-2.5 text-sm dark:bg-white/[0.04]">
          {completed ? (
            <>
              <CheckCircle2 className="h-4 w-4 shrink-0 text-violet-500" />
              <span className="font-semibold text-zinc-700 dark:text-zinc-200">
                {formatEndDate(g.drawnAt || g.endAt)} tarixində sonuçlandı
              </span>
            </>
          ) : (
            <>
              <Clock className="h-4 w-4 shrink-0 text-violet-500" />
              <span className="font-semibold text-zinc-700 dark:text-zinc-200">
                Bitməyə: <span className="tabular-nums text-violet-600 dark:text-violet-300">{countdown}</span>
              </span>
            </>
          )}
        </div>

        {!completed && !g.joined && (
          <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            {ENTRY_HINT[g.entryCondition] || ""}
          </p>
        )}

        <div className="mt-auto pt-2">
          {completed ? (
            <button
              onClick={() => onShowWinners(g)}
              className="w-full rounded-xl bg-zinc-200 px-4 py-3 text-sm font-black text-zinc-700 transition hover:bg-zinc-300 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
            >
              Nəticələri gör
            </button>
          ) : g.joined ? (
            <div className="w-full rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-center text-sm font-black text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300">
              ✓ Qoşuldun
            </div>
          ) : (
            <button
              onClick={() => onJoin(g)}
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-3 text-sm font-black text-white shadow-[0_16px_40px_-20px_rgba(168,85,247,0.9)] transition hover:-translate-y-0.5 hover:from-violet-500 hover:to-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flame className="h-4 w-4" />}
              Çəkilişə qoşul
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function WinnersModal({ g, onClose }: { g: Giveaway; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative bg-gradient-to-br from-violet-600 to-indigo-600 p-6">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full bg-white/20 p-1.5 text-white transition hover:bg-white/30"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2 text-white/90">
            <Trophy className="h-5 w-5" />
            <span className="text-sm font-bold uppercase tracking-wide">Qaliblər</span>
          </div>
          <h3 className="mt-2 text-lg font-black text-white">{g.title}</h3>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-white/85">
            <Gift className="h-4 w-4" /> {g.prizeLabel}
          </p>
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-5">
          {g.winners.length === 0 ? (
            <p className="py-6 text-center text-sm text-zinc-500">Qalib hələ elan olunmayıb.</p>
          ) : (
            <ul className="space-y-2">
              {g.winners.map((name, i) => (
                <li
                  key={i}
                  className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-white/10 dark:bg-white/[0.04]"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-xs font-black text-white">
                    {i + 1}
                  </span>
                  <span className="font-bold text-zinc-800 dark:text-zinc-100">{name}</span>
                  <Trophy className="ml-auto h-4 w-4 text-amber-500" />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

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
        <div className="mb-8">
          <h2 className="text-3xl font-black uppercase tracking-tight text-zinc-950 dark:text-white sm:text-4xl">
            Çəkilişlər
          </h2>
          <p className="mt-1 text-sm font-bold uppercase tracking-[0.18em] text-zinc-400">
            Fürsətləri qaçırma
          </p>
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
