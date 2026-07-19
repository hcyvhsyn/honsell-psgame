"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Gift,
  Users,
  Trophy,
  CheckCircle2,
  Crown,
  Flame,
  Clock,
  Loader2,
  ArrowLeft,
  ExternalLink,
} from "lucide-react";
import { useSession } from "@/components/SessionProvider";
import { socialPlatformLabel } from "@/lib/giveawaysShared";

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
  conditionUrl: string | null;
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
  FOLLOW_SOCIAL: "Qoşulmaq üçün sosial səhifəmizi izləməlisən.",
};

function entryHint(g: { entryCondition: string; conditionType: string | null }): string {
  if (g.entryCondition === "FOLLOW_SOCIAL") {
    return `Qoşulmaq üçün bizi ${socialPlatformLabel(g.conditionType)}-da izləməlisən.`;
  }
  return ENTRY_HINT[g.entryCondition] || "";
}

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

export default function GiveawayLandingClient({ id }: { id: string }) {
  const { user, loading: sessionLoading } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const wantsAutojoin = searchParams.get("autojoin") === "1";

  const [g, setG] = useState<Giveaway | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  // FOLLOW_SOCIAL: izlə linkinə kliklənmədən "Qoşul" aktiv olmur.
  const [followClicked, setFollowClicked] = useState(false);
  const autojoinTried = useRef(false);
  // Hook qaydası üçün erkən return-lardan əvvəl çağırılır (g hələ yox ola bilər).
  const countdown = useCountdown(g?.endAt ?? "");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/giveaways/${id}`, { cache: "no-store" });
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      const data = await res.json().catch(() => ({}));
      setG(data.giveaway ?? null);
    } catch {
      setError("Şəbəkə xətası. Yenidən cəhd et.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!sessionLoading) load();
  }, [sessionLoading, load]);

  const join = useCallback(async () => {
    if (!user) {
      // Qeydiyyat/girişdən sonra geri qayıdıb avtomatik qoşulsun.
      router.push(`/login?next=${encodeURIComponent(`/cekilis/${id}?autojoin=1`)}`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/giveaways/${id}/join`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Qoşulmaq alınmadı.");
        if (data.joined) load();
        return;
      }
      setG((prev) =>
        prev
          ? { ...prev, joined: true, participantCount: data.participantCount ?? prev.participantCount }
          : prev
      );
    } catch {
      setError("Şəbəkə xətası. Yenidən cəhd et.");
    } finally {
      setBusy(false);
    }
  }, [user, router, id, load]);

  // Girişdən sonra (autojoin=1) bir dəfə avtomatik qoşulma.
  useEffect(() => {
    if (!wantsAutojoin || autojoinTried.current) return;
    if (sessionLoading || loading || !g || !user) return;
    if (g.status !== "ACTIVE" || g.joined || !g.eligible) return;
    autojoinTried.current = true;
    join();
  }, [wantsAutojoin, sessionLoading, loading, g, user, join]);

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <div className="h-96 animate-pulse rounded-3xl border border-zinc-200 bg-zinc-100 dark:border-white/10 dark:bg-white/5" />
      </div>
    );
  }

  if (notFound || !g) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <Gift className="mx-auto h-12 w-12 text-zinc-300" />
        <h1 className="mt-4 text-xl font-black text-zinc-900 dark:text-white">Çəkiliş tapılmadı</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Bu çəkiliş mövcud deyil və ya artıq bitib.
        </p>
        <Link
          href="/#cekilisler"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-black text-white hover:bg-violet-700"
        >
          <ArrowLeft className="h-4 w-4" /> Bütün çəkilişlər
        </Link>
      </div>
    );
  }

  const completed = g.status === "COMPLETED";
  const needsFollow = g.entryCondition === "FOLLOW_SOCIAL" && Boolean(g.conditionUrl);
  // Login-dən qayıdan autojoin axını izləmə klikini artıq keçib sayılır.
  const joinLocked = needsFollow && !followClicked && !wantsAutojoin && !g.joined && !completed;

  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:py-14">
      <Link
        href="/#cekilisler"
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-500 transition hover:text-violet-600"
      >
        <ArrowLeft className="h-4 w-4" /> Bütün çəkilişlər
      </Link>

      <div className="flex flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-[0_24px_60px_-40px_rgba(76,29,149,0.5)] dark:border-white/10 dark:bg-white/[0.03]">
        {/* Gradient başlıq */}
        <div className="relative bg-gradient-to-br from-violet-600 via-violet-600 to-indigo-600 p-7 pb-6">
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
          <h1 className="max-w-[80%] text-2xl font-black leading-snug text-white">{g.title}</h1>
          <div className="mt-5 flex items-center gap-2 text-white/90">
            <Gift className="h-4 w-4" />
            <span className="text-sm font-bold">{g.prizeLabel}</span>
          </div>
        </div>

        {/* Gövdə */}
        <div className="flex flex-1 flex-col gap-3 p-6">
          {g.description && (
            <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-300">{g.description}</p>
          )}

          <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
            <Users className="h-4 w-4 text-violet-500" />
            <span className="font-bold text-zinc-900 dark:text-white">{g.participantCount}</span>
            <span>İştirakçı</span>
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
                  Bitməyə:{" "}
                  <span className="tabular-nums text-violet-600 dark:text-violet-300">{countdown}</span>
                </span>
              </>
            )}
          </div>

          {!completed && !g.joined && (
            <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">{entryHint(g)}</p>
          )}

          {/* İzlə düyməsi (FOLLOW_SOCIAL) */}
          {!completed && !g.joined && needsFollow && (
            <a
              href={g.conditionUrl!}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setFollowClicked(true)}
              className={`inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-black transition ${
                followClicked
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300"
                  : "border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100 dark:border-violet-400/30 dark:bg-violet-400/10 dark:text-violet-300"
              }`}
            >
              {followClicked ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <ExternalLink className="h-4 w-4" />
              )}
              {followClicked
                ? `${socialPlatformLabel(g.conditionType)} səhifəmiz açıldı`
                : `${socialPlatformLabel(g.conditionType)}-da bizi izlə`}
            </a>
          )}

          {error && (
            <div className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-300">
              {error}
            </div>
          )}

          {/* Qaliblər (tamamlanıbsa) */}
          {completed && g.winners.length > 0 && (
            <div className="mt-1">
              <div className="mb-2 flex items-center gap-1.5 text-sm font-bold text-zinc-700 dark:text-zinc-200">
                <Trophy className="h-4 w-4 text-amber-500" /> Qaliblər
              </div>
              <ul className="space-y-2">
                {g.winners.map((name, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 dark:border-white/10 dark:bg-white/[0.04]"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-xs font-black text-white">
                      {i + 1}
                    </span>
                    <span className="font-bold text-zinc-800 dark:text-zinc-100">{name}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-auto pt-2">
            {completed ? (
              <Link
                href="/#cekilisler"
                className="block w-full rounded-xl bg-zinc-200 px-4 py-3 text-center text-sm font-black text-zinc-700 transition hover:bg-zinc-300 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
              >
                Digər çəkilişlərə bax
              </Link>
            ) : g.joined ? (
              <div className="w-full rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-center text-sm font-black text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300">
                ✓ Qoşuldun — uğurlar!
              </div>
            ) : (
              <button
                onClick={join}
                disabled={busy || joinLocked}
                title={joinLocked ? "Əvvəlcə səhifəmizi izlə" : undefined}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-3.5 text-sm font-black text-white shadow-[0_16px_40px_-20px_rgba(168,85,247,0.9)] transition hover:-translate-y-0.5 hover:from-violet-500 hover:to-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flame className="h-4 w-4" />}
                {user ? "Çəkilişə qoşul" : "Qeydiyyatdan keç və qoşul"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
