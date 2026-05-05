"use client";

import { useEffect, useState } from "react";
import { Heart, BellRing, Sparkles, ListChecks } from "lucide-react";
import Modal from "./Modal";

/**
 * Listens for `honsell:favorite-intro` events emitted by the heart button on
 * the user's first add. Shows a one-time popup explaining what favoriting does
 * (sale email, wishlist) so the customer understands the mechanic.
 */
export default function FavoriteIntroModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("honsell:favorite-intro", handler);
    return () => window.removeEventListener("honsell:favorite-intro", handler);
  }, []);

  return (
    <Modal open={open} onClose={() => setOpen(false)} size="md" closeOnBackdrop>
      <div className="px-6 pb-6 pt-8 sm:px-8 sm:pb-8 sm:pt-10">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/40">
            <Heart className="h-6 w-6 fill-rose-400 text-rose-400" />
          </span>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white">
              Oyun favorilərinə əlavə olundu!
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Niyə favoriləri istifadə edək? Qısaca izah edirik.
            </p>
          </div>
        </div>

        <ul className="mt-6 space-y-4 text-sm text-zinc-300">
          <li className="flex items-start gap-3">
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30">
              <BellRing className="h-4 w-4" />
            </span>
            <span>
              <b className="text-white">Endirim olduqda email:</b>{" "}
              favorilədiyin oyun yenidən endirimə düşəndə sənə avtomatik bildiriş
              göndəririk — kampaniyanı qaçırmırsan.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-500/30">
              <ListChecks className="h-4 w-4" />
            </span>
            <span>
              <b className="text-white">Wishlist (istək siyahısı):</b>{" "}
              bütün favoriləri profil səhifəndəki <i>Favorilər</i> bölməsində
              bir yerdə görürsən.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30">
              <Sparkles className="h-4 w-4" />
            </span>
            <span>
              <b className="text-white">Tövsiyə üçün:</b> hansı janrları sevdiyini
              başa düşürük və daha uyğun oyunları irəli çəkirik.
            </span>
          </li>
        </ul>

        <button
          type="button"
          onClick={() => setOpen(false)}
          className="mt-7 inline-flex w-full items-center justify-center rounded-xl bg-[#6D28D9] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#5B21B6]"
        >
          Başa düşdüm
        </button>
        <p className="mt-3 text-center text-xs text-zinc-500">
          Bu məlumat yalnız ilk dəfə göstərilir.
        </p>
      </div>
    </Modal>
  );
}
