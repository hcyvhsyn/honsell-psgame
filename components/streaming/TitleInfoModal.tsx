"use client";

/**
 * Kartdakı ⓘ düyməsinin modalı — səhifə dəyişmədan dublyaj/altyazı məlumatı.
 *   Xülasə   — əsas 3 dil, sezonlar arası fərqlər, sezon × dil matrisi
 *   Ətraflı  — epizod-epizod (EpisodeLanguageExplorer)
 *   Digər    — digər dillər, CC, səsli təsvir
 * Data `/api/streaming/title-detail`-dən gəlir (detal səhifəsi ilə eyni loader).
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2 } from "lucide-react";
import Modal from "@/components/Modal";
import EpisodeLanguageExplorer from "@/components/streaming/EpisodeLanguageExplorer";
import { LanguageRows } from "@/components/streaming/LanguageSlots";
import { OtherLanguages, SeasonChanges, SeasonMatrix, SummaryTable, VerificationNote } from "@/components/streaming/TitleLanguagePanels";
import { languageSlots } from "@/lib/streamingLanguageStates";
import type { StreamingTitleDetail } from "@/lib/streamingTitleDetail";

type Tab = "summary" | "episodes" | "other";

// Sessiya ərzində təkrar açılışda yenidən sorğu getməsin.
const cache = new Map<string, StreamingTitleDetail>();

export default function TitleInfoModal({
  open,
  onClose,
  slug,
  kind,
  title,
  detailHref,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  kind: "MOVIE" | "SERIES";
  title: string;
  detailHref: string;
}) {
  const cacheKey = `${kind}|${slug}`;
  const [detail, setDetail] = useState<StreamingTitleDetail | null>(() => cache.get(cacheKey) ?? null);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<Tab>("summary");

  useEffect(() => {
    if (!open || detail) return;
    const ctrl = new AbortController();
    setError(false);
    fetch(`/api/streaming/title-detail?kind=${kind}&slug=${encodeURIComponent(slug)}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: StreamingTitleDetail) => {
        cache.set(cacheKey, d);
        setDetail(d);
      })
      .catch((e) => {
        if ((e as Error).name !== "AbortError") setError(true);
      });
    return () => ctrl.abort();
  }, [open, detail, kind, slug, cacheKey]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const hbo = detail?.hbo;
  // Filmdə sezon/epizod yoxdur — yalnız xülasə + digər dillər.
  const seasons = detail?.kind === "SERIES" ? (hbo?.seasons ?? []) : [];
  const hasLangs = !!detail && (detail.audioLanguages.length > 0 || detail.subtitleLanguages.length > 0);
  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "summary", label: "Xülasə" },
    ...(seasons.length ? [{ id: "episodes" as Tab, label: "Epizodlar üzrə (ətraflı)" }] : []),
    ...(hbo?.otherLanguages.length ? [{ id: "other" as Tab, label: "Digər dillər" }] : []),
  ];

  return (
    <Modal open={open} onClose={onClose} size="xl" closeOnBackdrop>
      <div className="p-5 sm:p-6">
        <div className="mb-4 flex items-start gap-4 pr-12">
          {detail?.posterUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={detail.posterUrl} alt="" className="hidden w-16 shrink-0 rounded-lg border border-zinc-200 dark:border-white/10 sm:block" />
          ) : null}
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Dublyaj və altyazı · Azərbaycan</p>
            <h2 className="text-xl font-black text-white sm:text-2xl">{title}</h2>
            {detail?.year ? <p className="text-xs font-semibold text-zinc-500">{detail.year}</p> : null}
          </div>
        </div>

        {!detail ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-zinc-400">
            {error ? (
              "Məlumatı yükləmək alınmadı. Bir az sonra yenidən yoxla."
            ) : (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Yüklənir…
              </>
            )}
          </div>
        ) : (
          <>
            {tabs.length > 1 ? (
              <div className="mb-5 flex gap-1 overflow-x-auto border-b border-zinc-200 dark:border-white/10" role="tablist">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={tab === t.id}
                    onClick={() => setTab(t.id)}
                    className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-bold transition ${
                      tab === t.id ? "border-violet-600 text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            ) : null}

            {tab === "summary" ? (
              <div className="space-y-6">
                {hasLangs ? (
                  <div className="grid gap-5 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.02] md:grid-cols-[auto_1fr] md:items-center">
                    <LanguageRows slots={languageSlots(detail)} size="md" tone="auto" />
                    <SummaryTable slots={languageSlots(detail)} />
                  </div>
                ) : (
                  <p className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-400 dark:border-white/10 dark:bg-white/[0.02]">
                    Dil məlumatı hələ Azərbaycan üçün yoxlanılır.
                  </p>
                )}

                {seasons.length > 1 ? (
                  <section>
                    <h3 className="mb-2 text-sm font-black text-white">Sezonlar arası fərqlər</h3>
                    <SeasonChanges seasons={seasons} />
                  </section>
                ) : null}

                {seasons.length ? (
                  <section>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <h3 className="text-sm font-black text-white">Sezonlar üzrə</h3>
                      <button type="button" onClick={() => setTab("episodes")} className="text-xs font-bold text-violet-600 hover:underline dark:text-violet-300">
                        Epizod-epizod bax →
                      </button>
                    </div>
                    <SeasonMatrix seasons={seasons} />
                  </section>
                ) : null}
              </div>
            ) : null}

            {tab === "episodes" && hbo ? <EpisodeLanguageExplorer seasons={seasons} episodeTracks={hbo.episodeTracks} /> : null}
            {tab === "other" && hbo ? <OtherLanguages rows={hbo.otherLanguages} /> : null}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-4 dark:border-white/10">
              <div className="min-w-0 flex-1">{hbo ? <VerificationNote hbo={hbo} kind={detail.kind} /> : null}</div>
              <Link href={detailHref} className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
                Ayrıca səhifədə aç <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
