"use client";

import { useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";

export default function ScreenshotGallery({
  screenshots,
  gameTitle,
}: {
  screenshots: string[];
  gameTitle?: string;
}) {
  const [active, setActive] = useState<string | null>(null);
  // Yüklənməyən şəkil boş boz kadr kimi qalırdı — onu siyahıdan çıxarırıq.
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
  const visible = screenshots.filter((u) => !failed.has(u));

  if (visible.length === 0) return null;

  const altFor = (i: number) =>
    gameTitle ? `${gameTitle} oyununun ekran görüntüsü ${i + 1}` : `Oyun ekran görüntüsü ${i + 1}`;

  return (
    <>
      {/* Telefonda üfüqi lent (uzun 2-sütunlu şəbəkə ~2 ekran tuturdu), sm+ şəbəkə. */}
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden">
        {visible.map((url, i) => (
          <button
            key={url}
            type="button"
            onClick={() => setActive(url)}
            className="group relative aspect-video w-[80%] shrink-0 snap-start overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 transition hover:border-indigo-500/50 sm:w-auto"
          >
            <Image
              src={url}
              alt={altFor(i)}
              fill
              sizes="(max-width: 640px) 80vw, 33vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              onError={() => setFailed((prev) => new Set(prev).add(url))}
            />
          </button>
        ))}
      </div>

      {active && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setActive(null)}
        >
          <button
            type="button"
            onClick={() => setActive(null)}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label="Bağla"
          >
            <X className="h-5 w-5" />
          </button>
          <div
            className="relative aspect-video w-full max-w-5xl overflow-hidden rounded-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={active}
              alt={gameTitle ? `${gameTitle} oyununun böyüdülmüş ekran görüntüsü` : "Oyun ekran görüntüsü"}
              fill
              sizes="100vw"
              className="object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
}
