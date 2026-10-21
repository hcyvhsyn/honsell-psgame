/**
 * Film/serial detal səhifəsi (server) — "hansı dildə dublyaj, hansı dildə altyazı var?"
 * sualının tam cavabı: xülasə (TR/RU/EN), sezon-sezon matris, epizod siyahısı, digər dillər.
 *
 * HBO Max hissəsi yalnız AZ player-də TƏSDİQLƏNMİŞ region treklərindən gəlir.
 */
import Link from "next/link";
import { ArrowLeft, ExternalLink, Film, Tv as TvIcon } from "lucide-react";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import EpisodeLanguageExplorer from "@/components/streaming/EpisodeLanguageExplorer";
import { LanguageRows } from "@/components/streaming/LanguageSlots";
import { OtherLanguages, SeasonChanges, SeasonMatrix, SummaryTable, VerificationNote } from "@/components/streaming/TitleLanguagePanels";
import { languageSlots } from "@/lib/streamingLanguageStates";
import type { StreamingTitleDetail } from "@/lib/streamingTitleDetail";

const PLATFORM_LABEL: Record<string, string> = { HBOMAX: "HBO Max", PRIME: "Prime Video", NETFLIX: "Netflix", GAIN: "Gain" };

export default function StreamingTitleDetailView({ detail }: { detail: StreamingTitleDetail }) {
  const Kind = detail.kind === "SERIES" ? TvIcon : Film;
  const slots = languageSlots(detail);
  const hasLangs = detail.audioLanguages.length > 0 || detail.subtitleLanguages.length > 0;
  const hbo = detail.hbo;
  const seasons = detail.kind === "SERIES" ? (hbo?.seasons ?? []) : [];
  const backHref = `/streaming/katalog?kind=${detail.kind}`;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <SiteHeaderServer />

      <section className="relative overflow-hidden border-b border-zinc-200 dark:border-white/5">
        {detail.backdropUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={detail.backdropUrl} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-25" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-white via-white/85 to-white/40 dark:from-zinc-950 dark:via-zinc-950/80 dark:to-zinc-950/40" />
        <div className="site-container relative py-8 sm:py-10">
          <Link href={backHref} className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Kataloqa qayıt
          </Link>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
            {detail.posterUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={detail.posterUrl} alt={detail.title} className="w-36 shrink-0 rounded-xl border border-zinc-200 dark:border-white/10 shadow-2xl sm:w-44" />
            ) : null}
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-zinc-400">
                <span className="inline-flex items-center gap-1 rounded-full border border-zinc-300 px-2 py-0.5 uppercase dark:border-white/15">
                  <Kind className="h-3.5 w-3.5" /> {detail.kind === "SERIES" ? "Serial" : "Film"}
                </span>
                {detail.year ? <span>{detail.year}</span> : null}
                {detail.genres.length ? <span>· {detail.genres.join(", ")}</span> : null}
              </div>
              <h1 className="text-3xl font-black text-white sm:text-4xl">{detail.title}</h1>
              {detail.description ? <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-300">{detail.description}</p> : null}
              <div className="mt-4 flex flex-wrap gap-2">
                {detail.platforms.map((p) =>
                  p.deepLinkUrl ? (
                    <a
                      key={p.platform}
                      href={p.deepLinkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full bg-violet-600 px-3 py-1.5 text-sm font-bold text-[#ffffff] hover:bg-violet-500"
                    >
                      İzlə · {PLATFORM_LABEL[p.platform] ?? p.platform} <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : (
                    <span key={p.platform} className="rounded-full bg-violet-600 px-3 py-1.5 text-sm font-bold text-[#ffffff]">
                      {PLATFORM_LABEL[p.platform] ?? p.platform}
                    </span>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="site-container space-y-10 py-8">
        <section>
          <h2 className="mb-1 text-xl font-black text-white">Azərbaycanda dublyaj və altyazı</h2>
          <p className="mb-4 text-sm text-zinc-400">{detail.kind === "SERIES" ? "Əsas 3 dil. Sezonlar arasında fərq varsa aşağıda sezon-sezon göstərilir." : "Əsas 3 dil."}</p>
          {hasLangs ? (
            <div className="grid gap-6 rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/[0.02] p-5 lg:grid-cols-[auto_1fr] lg:items-center">
              <LanguageRows slots={slots} size="md" tone="auto" />
              <SummaryTable slots={slots} />
            </div>
          ) : (
            <p className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/[0.02] p-5 text-sm text-zinc-400">
              Dil məlumatı hələ Azərbaycan üçün yoxlanılır.
            </p>
          )}
          {hbo ? (
            <div className="mt-3">
              <VerificationNote hbo={hbo} kind={detail.kind} />
            </div>
          ) : null}
        </section>

        {hbo && seasons.length ? (
          <section>
            <h2 className="mb-4 text-xl font-black text-white">Sezonlar üzrə</h2>
            {seasons.length > 1 ? (
              <div className="mb-4">
                <h3 className="mb-2 text-sm font-black text-white">Sezonlar arası fərqlər</h3>
                <SeasonChanges seasons={seasons} />
              </div>
            ) : null}
            <SeasonMatrix seasons={seasons} />
          </section>
        ) : null}

        {hbo && seasons.length ? (
          <section>
            <h2 className="mb-1 text-xl font-black text-white">Epizodlar üzrə (ətraflı)</h2>
            <p className="mb-4 text-sm text-zinc-400">Dil seç — hansı epizodlarda olduğunu görəcəksən.</p>
            <EpisodeLanguageExplorer seasons={seasons} episodeTracks={hbo.episodeTracks} />
          </section>
        ) : null}

        {hbo && hbo.otherLanguages.length ? (
          <section>
            <h2 className="mb-4 text-xl font-black text-white">Digər dillər</h2>
            <OtherLanguages rows={hbo.otherLanguages} />
          </section>
        ) : null}
      </div>
    </main>
  );
}
