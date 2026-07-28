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

  if (screenshots.length === 0) return null;

  const altFor = (i: number) =>
    gameTitle ? `${gameTitle} oyununun ekran görüntüsü ${i + 1}` : `Oyun ekran görüntüsü ${i + 1}`;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {screenshots.map((url, i) => (
          <button
            key={url}
            type="button"
            onClick={() => setActive(url)}
            className="group relative aspect-video overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 transition hover:border-indigo-500/50"
          >
            <Image
              src={url}
              alt={altFor(i)}
              fill
              sizes="(max-width: 640px) 50vw, 33vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
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
