"use client";

import { useState } from "react";
import { CircleDot, Gamepad2, Globe, Smartphone } from "lucide-react";

/**
 * Aktivləşdirmə ÜSULLARI — seqment keçidi + seçilmiş üsulun addımları.
 *
 * Niyə tab, niyə vahid nömrələnmiş siyahı deyil: konsol / mobil tətbiq /
 * brauzer bir-birini ƏVƏZ EDƏN yollardır. Hamısı 1→6 kimi nömrələnəndə
 * müştəri altı addımın hamısını etməli olduğunu düşünür. İndi nömrələr yalnız
 * SEÇİLMİŞ üsulun içində, 1-dən başlayaraq gedir — yəni real ardıcıllıq.
 *
 * ⚠️ Client komponentdir: `lib/activationSteps` (prisma) BURAYA import olunmur,
 * tiplər lokal saxlanılır (bax reels-dəki eyni qəsdli tip dublikatı).
 */

export type MethodStep = {
  id: string;
  title: string;
  body: string | null;
  imageUrl: string | null;
};

export type MethodGroup = {
  method: string;
  steps: MethodStep[];
};

/** Tailwind JIT üçün sinif adları LİTERAL olmalıdır — dinamik string qurmuruq. */
const ACCENTS = [
  { node: "bg-gradient-to-br from-violet-500 to-violet-700", bar: "bg-violet-500", ghost: "text-violet-500" },
  { node: "bg-gradient-to-br from-indigo-500 to-indigo-700", bar: "bg-indigo-500", ghost: "text-indigo-500" },
  { node: "bg-gradient-to-br from-fuchsia-500 to-fuchsia-700", bar: "bg-fuchsia-500", ghost: "text-fuchsia-500" },
] as const;

/**
 * Üsul adına görə ikon. Ad admin paneldən SƏRBƏST mətn olduğu üçün açar sözlə
 * uyğunlaşdırılır və tanınmayanda neytral ikona düşür — yeni üsul əlavə etmək
 * üçün kod dəyişmək lazım gəlmir.
 */
function iconFor(method: string) {
  const m = method.toLocaleLowerCase("az");
  if (/konsol|ps5|ps4|playstation stat/.test(m)) return Gamepad2;
  if (/tətbiq|tetbiq|mobil|app|telefon|ios|android/.test(m)) return Smartphone;
  if (/brauzer|browser|web|sayt|kompüter|komputer/.test(m)) return Globe;
  return CircleDot;
}

function StepList({ steps }: { steps: MethodStep[] }) {
  return (
    <ol className="relative">
      {/* Onurğa — addımlar arasındaki əlaqəni göstərir */}
      {steps.length > 1 && (
        <span
          aria-hidden
          className="absolute bottom-8 left-[18px] top-3 w-[2px] -translate-x-1/2 rounded-full bg-gradient-to-b from-violet-500/60 via-indigo-500/35 to-transparent"
        />
      )}

      {steps.map((s, i) => {
        const a = ACCENTS[i % ACCENTS.length];
        return (
          <li key={s.id} className="relative pb-5 pl-12 last:pb-0">
            <span
              className={`absolute left-[18px] top-2 z-10 grid h-9 w-9 -translate-x-1/2 place-items-center rounded-full text-[13px] font-black !text-white shadow-lg ring-4 ring-zinc-50 dark:ring-zinc-950 ${a.node}`}
            >
              {i + 1}
            </span>

            <div className="group relative overflow-hidden rounded-2xl bg-white/80 shadow-sm ring-1 ring-zinc-200 backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-violet-600/10 dark:bg-white/[0.04] dark:ring-white/10">
              <span aria-hidden className={`absolute inset-y-0 left-0 w-[3px] ${a.bar}`} />
              <span
                aria-hidden
                className={`pointer-events-none absolute -top-3 right-2 select-none text-[4.5rem] font-black leading-none opacity-[0.07] transition-opacity duration-300 group-hover:opacity-[0.13] ${a.ghost}`}
              >
                {String(i + 1).padStart(2, "0")}
              </span>

              <div className="relative px-5 py-4">
                <h3 className="pr-12 text-[15px] font-bold leading-snug text-zinc-950 dark:text-white">
                  {s.title}
                </h3>
                {s.body && (
                  <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                    {s.body}
                  </p>
                )}
              </div>
            </div>

            {/* Ekran görüntüsü — «cihaz ekranı» çərçivəsində */}
            {s.imageUrl && (
              <figure className="mt-3 max-w-md overflow-hidden rounded-2xl bg-zinc-100 ring-1 ring-zinc-200 dark:bg-zinc-900/60 dark:ring-white/10">
                <div className="flex items-center gap-1.5 px-3 py-2">
                  <span className="h-2 w-2 rounded-full bg-rose-400/70" />
                  <span className="h-2 w-2 rounded-full bg-amber-400/70" />
                  <span className="h-2 w-2 rounded-full bg-emerald-400/70" />
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s.imageUrl}
                  alt={s.title}
                  loading="lazy"
                  decoding="async"
                  className="block h-auto w-full"
                />
              </figure>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export default function ActivationMethodTabs({ groups }: { groups: MethodGroup[] }) {
  const [active, setActive] = useState(0);

  // Üsul adı yoxdursa (köhnə məzmun) tab göstərmirik — sadə siyahı.
  const tabbed = groups.length > 1 && groups.every((g) => g.method.length > 0);
  if (!tabbed) {
    return <StepList steps={groups.flatMap((g) => g.steps)} />;
  }

  const current = groups[Math.min(active, groups.length - 1)];

  return (
    <div>
      {/* Seqment keçidi — üsullar alternativ olduğu üçün eyni anda BİRİ görünür */}
      <div
        role="tablist"
        aria-label="Aktivləşdirmə üsulu"
        className="mb-7 flex flex-wrap gap-2"
      >
        {groups.map((g, i) => {
          const Icon = iconFor(g.method);
          const on = i === active;
          return (
            <button
              key={g.method}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setActive(i)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                on
                  ? "bg-gradient-to-r from-violet-600 to-indigo-600 !text-white shadow-lg shadow-violet-600/25"
                  : "bg-white text-zinc-700 ring-1 ring-zinc-200 hover:ring-violet-300 dark:bg-white/[0.04] dark:text-zinc-300 dark:ring-white/10 dark:hover:ring-violet-500/40"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {g.method}
              <span
                className={`rounded-md px-1.5 py-0.5 text-[10px] font-black ${
                  on ? "bg-white/20" : "bg-zinc-100 text-zinc-500 dark:bg-white/10 dark:text-zinc-400"
                }`}
              >
                {g.steps.length}
              </span>
            </button>
          );
        })}
      </div>

      <div role="tabpanel">
        <StepList steps={current.steps} />
      </div>
    </div>
  );
}
