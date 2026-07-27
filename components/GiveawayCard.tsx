"use client";

import { useEffect, useState } from "react";
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
  ExternalLink,
  Star,
  Quote,
  Info,
  BadgeCheck,
} from "lucide-react";
import { socialPlatformLabel, formatAzDateTime } from "@/lib/giveawaysShared";

/** Ana səhifə + arxiv arasında paylaşılan çəkiliş kartı. */

export type Giveaway = {
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

/** FOLLOW_SOCIAL şərti üçün qoşulmadan əvvəl göstərilən dinamik ipucu. */
export function giveawayEntryHint(g: {
  entryCondition: string;
  conditionType: string | null;
}): string {
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
  return formatAzDateTime(iso);
}

export function GiveawayCard({
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

  // FOLLOW_SOCIAL: izlə linkinə kliklənməmiş "Qoşul" aktiv olmur (server izləməni
  // yoxlaya bilmədiyi üçün bu, yumşaq client-tərəfi qapıdır).
  const needsFollow = g.entryCondition === "FOLLOW_SOCIAL" && Boolean(g.conditionUrl);
  const [followClicked, setFollowClicked] = useState(false);
  const joinLocked = needsFollow && !followClicked && !g.joined && !completed;

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
                {formatEndDate(g.drawnAt || g.endAt)} tarixində yekunlaşdı
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
            {giveawayEntryHint(g)}
          </p>
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
            {followClicked ? <CheckCircle2 className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}
            {followClicked
              ? `${socialPlatformLabel(g.conditionType)} səhifəmiz açıldı`
              : `${socialPlatformLabel(g.conditionType)}-da bizi izlə`}
          </a>
        )}

        <div className="mt-auto pt-2">
          {completed ? (
            <div className="group relative">
              {/* Diqqət çəkən canlı işıq (arxa fon) */}
              <div className="absolute -inset-0.5 animate-pulse rounded-xl bg-gradient-to-r from-amber-400 via-fuchsia-500 to-violet-500 opacity-60 blur-md" />
              <button
                onClick={() => onShowWinners(g)}
                className="relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-fuchsia-600 px-4 py-3.5 text-sm font-black text-white shadow-lg shadow-fuchsia-500/40 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-fuchsia-500/50"
              >
                <Trophy className="h-4 w-4 transition-transform duration-300 group-hover:-rotate-12" />
                Nəticələri gör
                <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
              </button>
            </div>
          ) : g.joined ? (
            <div className="w-full rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-center text-sm font-black text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300">
              ✓ Qoşuldun
            </div>
          ) : (
            <button
              onClick={() => onJoin(g)}
              disabled={busy || joinLocked}
              title={joinLocked ? "Əvvəlcə səhifəmizi izlə" : undefined}
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

type WinnerReview = {
  name: string;
  avatarUrl: string | null;
  instagramUsername: string | null;
  text: string;
  rating: number | null;
  imageUrl: string | null;
  videoUrl: string | null;
  entryMethod: string;
  source: string;
  provenanceLabel: string;
  createdAt: string | null;
};
type StoreNote = { text: string; imageUrl: string | null; createdAt: string | null };

export function WinnersModal({ g, onClose }: { g: Giveaway; onClose: () => void }) {
  const [reviews, setReviews] = useState<WinnerReview[]>([]);
  const [storeNotes, setStoreNotes] = useState<StoreNote[]>([]);
  const [loading, setLoading] = useState(true);

  // Rəylər siyahı endpoint-ində gəlmir — modal açılanda tək çəkiliş məlumatından
  // (artıq reviews + storeNotes qaytarır) lazy yüklənir.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/giveaways/${g.id}`, { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!alive) return;
        setReviews(Array.isArray(data.giveaway?.reviews) ? data.giveaway.reviews : []);
        setStoreNotes(Array.isArray(data.giveaway?.storeNotes) ? data.giveaway.storeNotes : []);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [g.id]);

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
        <div className="max-h-[65vh] overflow-y-auto p-5">
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

          {/* Qaliblərin rəyləri — sosial sübut */}
          {loading ? (
            <div className="mt-4 flex items-center justify-center py-3 text-zinc-400">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : (
            <>
              {reviews.length > 0 && (
                <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-white/10">
                  <div className="mb-3 flex items-center gap-1.5 text-sm font-bold text-zinc-700 dark:text-zinc-200">
                    <Quote className="h-4 w-4 text-violet-500" /> Qaliblərin rəyləri
                  </div>
                  <div className="space-y-3">
                    {reviews.map((r, i) => (
                      <div
                        key={i}
                        className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.03]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-xs font-black text-white">
                              {r.name.charAt(0).toUpperCase() || "?"}
                            </span>
                            <div className="min-w-0">
                              <span className="block text-sm font-bold text-zinc-800 dark:text-zinc-100">
                                {r.name}
                              </span>
                              {r.instagramUsername && (
                                <span className="block text-xs text-zinc-400">
                                  @{r.instagramUsername.replace(/^@/, "")}
                                </span>
                              )}
                            </div>
                          </div>
                          {r.rating != null && (
                            <div className="flex shrink-0 items-center gap-0.5">
                              {[1, 2, 3, 4, 5].map((n) => (
                                <Star
                                  key={n}
                                  className={`h-3.5 w-3.5 ${
                                    n <= (r.rating ?? 0)
                                      ? "fill-amber-400 text-amber-400"
                                      : "text-zinc-300 dark:text-zinc-600"
                                  }`}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                        <p className="mt-2.5 whitespace-pre-line text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                          {r.text}
                        </p>
                        {r.imageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={r.imageUrl}
                            alt={`${r.name} — mükafat fotosu`}
                            loading="lazy"
                            className="mt-3 max-h-72 w-full rounded-xl border border-zinc-200 object-cover dark:border-white/10"
                          />
                        )}
                        {r.videoUrl && (
                          <video
                            src={r.videoUrl}
                            controls
                            preload="metadata"
                            className="mt-3 max-h-72 w-full rounded-xl border border-zinc-200 dark:border-white/10"
                          />
                        )}
                        {r.provenanceLabel && (
                          <div className="mt-2.5 flex items-center gap-1.5 text-[11px] font-medium text-zinc-400">
                            <Info className="h-3 w-3 shrink-0" />
                            <span>{r.provenanceLabel}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Mağaza açıqlaması — qalib rəyi kimi göstərilmir */}
              {storeNotes.length > 0 && (
                <div className="mt-3 space-y-3">
                  {storeNotes.map((n, i) => (
                    <div
                      key={i}
                      className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4 dark:border-violet-400/20 dark:bg-violet-400/5"
                    >
                      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-violet-700 dark:text-violet-300">
                        <BadgeCheck className="h-3.5 w-3.5" /> Honsell Store açıqlaması
                      </div>
                      <p className="whitespace-pre-line text-sm leading-6 text-zinc-700 dark:text-zinc-200">
                        {n.text}
                      </p>
                      {n.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={n.imageUrl}
                          alt="Honsell Store açıqlaması"
                          loading="lazy"
                          className="mt-3 max-h-72 w-full rounded-xl border border-violet-200 object-cover dark:border-violet-400/20"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
