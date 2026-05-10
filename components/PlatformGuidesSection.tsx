import { BookOpen, PlayCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";

/**
 * Verilmiş scope üçün aktiv "Faydalı başlıqlar" kollektivini göstərir.
 * Hər guide accordion-stilli açıqlana bilən detail-summary blokunda render olunur
 * — spesifik markdown lib istifadə etmirik, mətn `whitespace-pre-line` ilə göstərilir.
 */
export default async function PlatformGuidesSection({ scope }: { scope: string }) {
  const guides = await prisma.platformGuide.findMany({
    where: { scope, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  if (guides.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="mb-6 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl border border-amber-400/30 bg-gradient-to-br from-amber-400/20 to-orange-400/15 text-amber-200">
          <BookOpen className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-2xl font-black text-white sm:text-3xl">Faydalı başlıqlar</h2>
          <p className="text-sm text-zinc-500">
            Tez-tez verilən sualların cavabları və qısa təlimatlar.
          </p>
        </div>
      </header>

      <div className="space-y-3">
        {guides.map((g) => (
          <details
            key={g.id}
            className="group rounded-2xl border border-white/10 bg-zinc-900/40 transition hover:border-white/15"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <p className="truncate text-base font-bold text-white">{g.title}</p>
                {g.summary && (
                  <p className="mt-1 line-clamp-1 text-xs text-zinc-400">{g.summary}</p>
                )}
              </div>
              <span className="shrink-0 text-2xl font-light text-zinc-500 transition group-open:rotate-45">
                +
              </span>
            </summary>
            <div className="space-y-4 border-t border-white/5 px-5 py-4">
              <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-200">
                {g.body}
              </p>
              {g.videoUrl && (
                <a
                  href={g.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg bg-rose-500/15 px-4 py-2 text-sm font-semibold text-rose-200 ring-1 ring-rose-500/30 transition hover:bg-rose-500/25"
                >
                  <PlayCircle className="h-4 w-4" /> Videoya bax
                </a>
              )}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
