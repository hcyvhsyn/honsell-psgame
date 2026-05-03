"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import Modal from "./Modal";

type Variant = "default" | "compact";

export default function PlatformInfoButton({
  variant = "default",
  className = "",
}: {
  variant?: Variant;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  const trigger =
    variant === "compact" ? (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label="Platforma haqqında məlumat"
        title="PS4 / PS5 nə deməkdir?"
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-zinc-200 backdrop-blur-md transition hover:bg-black/70 hover:text-white ${className}`}
      >
        <Info className="h-3 w-3" />
      </button>
    ) : (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Platforma haqqında məlumat"
        className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border border-transparent bg-zinc-950/60 text-zinc-300 transition hover:bg-zinc-900 hover:text-white ${className}`}
      >
        <Info className="h-4 w-4" />
      </button>
    );

  return (
    <>
      {trigger}
      <Modal open={open} onClose={() => setOpen(false)} size="md" closeOnBackdrop>
        <div className="p-6 sm:p-7">
          <h2 className="text-xl font-semibold tracking-tight text-white">
            PS4, PS5 və PS4 + PS5 nə deməkdir?
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Oyunun üzərindəki etiket konsol uyğunluğunu göstərir.
          </p>

          <div className="mt-5 space-y-3">
            <section className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-4">
              <div className="mb-1.5 inline-flex items-center gap-2">
                <span className="rounded-full bg-sky-500/20 px-2.5 py-0.5 text-xs font-bold tracking-wider text-sky-200">
                  PS4
                </span>
                <span className="text-sm font-semibold text-white">Yalnız PS4 üçün</span>
              </div>
              <p className="text-sm leading-relaxed text-zinc-300">
                Oyun PS4 üçün hazırlanıb. Backward compatibility sayəsində PS5-də də
                oynanır, lakin qrafika və performans çox vaxt PS4 səviyyəsində qalır
                (bəzi oyunlarda &quot;PS5 boost&quot; ola bilər).
              </p>
            </section>

            <section className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4">
              <div className="mb-1.5 inline-flex items-center gap-2">
                <span className="rounded-full bg-violet-500/20 px-2.5 py-0.5 text-xs font-bold tracking-wider text-violet-200">
                  PS5
                </span>
                <span className="text-sm font-semibold text-white">Yalnız PS5 üçün</span>
              </div>
              <p className="text-sm leading-relaxed text-zinc-300">
                Oyun yalnız PS5 üçün hazırlanıb, PS4-də işləməyəcək. 4K / HDR qrafika,
                SSD ilə daha sürətli yüklənmə və DualSense xüsusiyyətləri (haptic
                vibrasiya, adaptive trigger) dəstəklənir.
              </p>
            </section>

            <section className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
              <div className="mb-1.5 inline-flex items-center gap-2">
                <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold tracking-wider text-emerald-200">
                  PS4 + PS5
                </span>
                <span className="text-sm font-semibold text-white">Hər iki konsol üçün</span>
              </div>
              <p className="text-sm leading-relaxed text-zinc-300">
                Cross-gen versiya: oyun həm PS4, həm də PS5-də tam dəstəklənir. PS5-də
                yeni nəsil performans (4K, sürətli loading), PS4-də öz versiyasında
                oynanır. Ən yaxşı variantdır.
              </p>
            </section>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Anladım
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
