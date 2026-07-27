"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Trophy, Gift, Star, Quote, Info, Loader2, ArrowLeft } from "lucide-react";
import { formatAzDateTime } from "@/lib/giveawaysShared";

type Review = {
  text: string;
  rating: number | null;
  imageUrl: string | null;
  videoUrl: string | null;
  provenanceLabel: string;
  createdAt: string | null;
};
type Winner = {
  name: string;
  avatarUrl: string | null;
  instagramUsername: string | null;
  delivered: boolean;
  reviews: Review[];
};
type HallGiveaway = {
  id: string;
  title: string;
  prizeLabel: string;
  prizeImageUrl: string | null;
  drawnAt: string | null;
  winners: Winner[];
};

export default function WinnersHallClient() {
  const [items, setItems] = useState<HallGiveaway[] | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/giveaways/winners-hall", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        setItems(Array.isArray(data.giveaways) ? data.giveaways : []);
      } catch {
        setItems([]);
      }
    })();
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <Link
        href="/#cekilisler"
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-500 transition hover:text-violet-600"
      >
        <ArrowLeft className="h-4 w-4" /> Çəkilişlər
      </Link>

      <header className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-fuchsia-500 shadow-lg shadow-fuchsia-500/30">
          <Trophy className="h-7 w-7 text-white" />
        </div>
        <h1 className="text-3xl font-black text-zinc-900 dark:text-white">Qazananlar</h1>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-zinc-500 dark:text-zinc-400">
          Çəkilişlərimizin real qazananları və onların rəyləri. Hədiyyələri həqiqətən veririk —
          özün bax və əmin ol.
        </p>
      </header>

      {items === null ? (
        <div className="flex justify-center py-16 text-zinc-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <p className="py-16 text-center text-sm text-zinc-500">Hələ qazanan elan olunmayıb.</p>
      ) : (
        <div className="space-y-8">
          {items.map((g) => (
            <section
              key={g.id}
              className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.03]"
            >
              <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-violet-600 to-indigo-600 p-5">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-black text-white">{g.title}</h2>
                  <p className="mt-0.5 flex items-center gap-1.5 text-sm text-white/85">
                    <Gift className="h-4 w-4 shrink-0" /> {g.prizeLabel}
                  </p>
                </div>
                {g.drawnAt && (
                  <span className="shrink-0 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold text-white/90 backdrop-blur">
                    {formatAzDateTime(g.drawnAt)}
                  </span>
                )}
              </div>

              <div className="space-y-3 p-5">
                {g.winners.map((w, i) => (
                  <div
                    key={i}
                    className="rounded-2xl border border-zinc-200 bg-zinc-50/60 p-4 dark:border-white/10 dark:bg-white/[0.03]"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-sm font-black text-white">
                        {w.name.charAt(0).toUpperCase() || "?"}
                      </span>
                      <div className="min-w-0">
                        <span className="block font-bold text-zinc-800 dark:text-zinc-100">
                          {w.name}
                        </span>
                        {w.instagramUsername && (
                          <span className="block text-xs text-zinc-400">
                            @{w.instagramUsername.replace(/^@/, "")}
                          </span>
                        )}
                      </div>
                      {w.delivered && (
                        <span className="ml-auto rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300">
                          ✅ Çatdırıldı
                        </span>
                      )}
                    </div>

                    {w.reviews.map((r, j) => (
                      <div
                        key={j}
                        className="mt-3 rounded-xl border border-zinc-200 bg-white p-3.5 dark:border-white/10 dark:bg-white/[0.02]"
                      >
                        <div className="flex items-center gap-1.5">
                          <Quote className="h-3.5 w-3.5 text-violet-400" />
                          {r.rating != null && (
                            <div className="flex items-center gap-0.5">
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
                        <p className="mt-2 whitespace-pre-line text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                          {r.text}
                        </p>
                        {r.imageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={r.imageUrl}
                            alt={`${w.name} — mükafat`}
                            loading="lazy"
                            className="mt-3 max-h-80 w-full rounded-xl border border-zinc-200 object-cover dark:border-white/10"
                          />
                        )}
                        {r.videoUrl && (
                          <video
                            src={r.videoUrl}
                            controls
                            preload="metadata"
                            className="mt-3 max-h-80 w-full rounded-xl border border-zinc-200 dark:border-white/10"
                          />
                        )}
                        {r.provenanceLabel && (
                          <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-zinc-400">
                            <Info className="h-3 w-3 shrink-0" />
                            <span>{r.provenanceLabel}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
