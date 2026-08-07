"use client";

import { Clapperboard, Gamepad2, Layers } from "lucide-react";
import type { ReelCategory } from "./types";

/**
 * İlk giriş sualı — istifadəçi nə izləmək istədiyini seçir.
 *
 * Oyun alan auditoriya ilə film/serial izləyən auditoriya bir-birini itələyir;
 * qarışıq feed hər ikisini itirir. Seçim `localStorage`-a yazılır və bir daha
 * soruşulmur (üstdəki keçidlə dəyişdirilə bilər).
 */
const OPTIONS: {
  value: ReelCategory;
  title: string;
  subtitle: string;
  Icon: typeof Gamepad2;
  accent: string;
}[] = [
  {
    value: "GAME",
    title: "Oyun",
    subtitle: "Trailer-lər, qiymətlər, tək toxunuşla səbətə",
    Icon: Gamepad2,
    accent: "from-violet-500 to-fuchsia-600",
  },
  {
    value: "STREAMING",
    title: "Film & Serial",
    subtitle: "Netflix, Prime və digər platformalardan",
    Icon: Clapperboard,
    accent: "from-rose-500 to-orange-500",
  },
  {
    value: "ALL",
    title: "Hamısı",
    subtitle: "Hər ikisi qarışıq göstərilsin",
    Icon: Layers,
    accent: "from-sky-500 to-emerald-500",
  },
];

export default function ReelCategoryGate({
  onPick,
}: {
  onPick: (category: ReelCategory) => void;
}) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-5 backdrop-blur-md">
      <div className="w-full max-w-md">
        <h1 className="text-center text-2xl font-black text-white">Nə izləmək istəyirsən?</h1>
        <p className="mt-2 text-center text-sm text-white/60">
          Feed-i sənə uyğunlaşdıraq. Sonra istənilən vaxt dəyişə bilərsən.
        </p>

        <div className="mt-6 space-y-3">
          {OPTIONS.map(({ value, title, subtitle, Icon, accent }) => (
            <button
              key={value}
              onClick={() => onPick(value)}
              className="flex w-full items-center gap-4 rounded-2xl border border-white/15 bg-white/5 p-4 text-left transition hover:border-white/40 hover:bg-white/10 active:scale-[0.98]"
            >
              <span
                className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${accent} text-white shadow-lg`}
              >
                <Icon className="h-6 w-6" />
              </span>
              <span className="min-w-0">
                <span className="block text-base font-bold text-white">{title}</span>
                <span className="block text-xs text-white/60">{subtitle}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
