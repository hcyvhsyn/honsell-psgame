/**
 * Marketing/landing səhifələri üçün ortaq UI komponentləri.
 * Hazırda `app/page.tsx` və `app/playstation/page.tsx` istifadə edir.
 */

import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

export function CategoryGroup({
  label,
  description,
  icon,
  accentClass,
  children,
}: {
  label: string;
  description?: string;
  icon: React.ReactNode;
  accentClass: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#0F0817] dark:shadow-none sm:p-6">
      <div className="mb-5 flex items-center gap-3">
        <span className={`grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-gradient-to-br backdrop-blur-sm ${accentClass}`}>
          {icon}
        </span>
        <div>
          <h3 className="text-xl font-black tracking-tight text-zinc-950 dark:text-white sm:text-2xl">{label}</h3>
          {description && <p className="text-xs text-zinc-600 dark:text-zinc-400 sm:text-sm">{description}</p>}
        </div>
      </div>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]">
        {children}
      </div>
    </div>
  );
}

export function SubCategoryCard({
  href,
  icon,
  label,
  sub,
  imageUrl,
  accentClass,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  sub: string;
  imageUrl?: string | null;
  accentClass: string;
}) {
  return (
    <Link
      href={href}
      className="group relative flex min-h-[140px] overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-400/50 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#A78BFA]/60 dark:border-white/10 dark:bg-[#150A21] dark:shadow-none dark:hover:border-indigo-500/40"
    >
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt=""
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1280px) 33vw, 16vw"
          unoptimized
          className="object-cover opacity-20 saturate-125 transition duration-500 group-hover:scale-105 group-hover:opacity-30 dark:opacity-25 dark:group-hover:opacity-35"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-violet-50 via-white to-zinc-100 dark:from-[#201032] dark:via-[#150A21] dark:to-[#0A0A0F]" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-white via-white/80 to-white/30 dark:from-[#0F0817] dark:via-[#0F0817]/80 dark:to-[#0F0817]/30" />

      <div className="relative z-10 flex flex-1 flex-col justify-between">
        <div className="flex items-start justify-between gap-3">
          <span className={`grid h-9 w-9 place-items-center rounded-xl border bg-gradient-to-br text-zinc-900 backdrop-blur-sm dark:text-white ${accentClass}`}>
            {icon}
          </span>
          <ArrowRight className="h-4 w-4 text-zinc-400 transition group-hover:translate-x-1 group-hover:text-zinc-900 dark:text-white/40 dark:group-hover:text-white" />
        </div>
        <div>
          <h4 className="text-base font-bold leading-tight text-zinc-950 dark:text-white">{label}</h4>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">{sub}</p>
        </div>
      </div>
    </Link>
  );
}

/** Böyük tek kart — top-level platform navigatorında istifadə olunur. */
export function PlatformCard({
  href,
  icon,
  label,
  sub,
  imageUrl,
  accentClass,
  badge,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  sub: string;
  imageUrl?: string | null;
  accentClass: string;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className="group relative flex min-h-[210px] overflow-hidden rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-indigo-400/50 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#A78BFA]/60 dark:border-white/10 dark:bg-[#150A21] dark:shadow-2xl dark:hover:border-indigo-500/40"
    >
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt=""
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1280px) 33vw, 16vw"
          unoptimized
          className="object-cover opacity-15 saturate-125 transition duration-700 group-hover:scale-105 group-hover:opacity-20 dark:opacity-20 dark:group-hover:opacity-25"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-violet-50 via-white to-zinc-100 dark:from-[#201032] dark:via-[#150A21] dark:to-[#0A0A0F]" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-white via-white/85 to-white/35 dark:from-[#150A21] dark:via-[#150A21]/85 dark:to-[#150A21]/35" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(124,58,237,0.12),transparent_34%)] opacity-80 dark:bg-[radial-gradient(circle_at_20%_15%,rgba(167,139,250,0.20),transparent_34%)]" />

      <div className="relative z-10 flex flex-1 flex-col justify-between">
        <div className="flex items-start justify-between gap-4">
          <span className={`grid h-11 w-11 place-items-center rounded-2xl border bg-gradient-to-br backdrop-blur-sm ${accentClass}`}>
            {icon}
          </span>
          {badge && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 ring-1 ring-amber-200 dark:bg-amber-400/20 dark:text-amber-200 dark:ring-amber-300/30">
              {badge}
            </span>
          )}
        </div>
        <div>
          <h3 className="text-lg font-black leading-tight text-zinc-950 dark:text-white">{label}</h3>
          <p className="mt-2 min-h-[42px] text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">{sub}</p>
          <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-violet-600 transition group-hover:text-zinc-950 dark:text-[#A78BFA] dark:group-hover:text-white">
            Keçid et <ArrowRight className="h-4 w-4" />
          </span>
        </div>
      </div>
    </Link>
  );
}

/**
 * Bölmə başlığı. Əvvəl bütün eni dolduran, sürətlə sürüşən və 15 dəfə təkrarlanan
 * böyük hərfli marquee idi — agressiv və yorucu görünürdü. İndi premium, statik,
 * mərkəzləşdirilmiş bir başlıq: hər iki yanda incə qradiyent xətt + bənövşəyi
 * vurğu nöqtəsi. Eyni `text` API-si saxlanılıb, ona görə bütün istifadə yerləri
 * avtomatik yenilənir.
 */
export function MarqueeHeader({ text }: { text: string }) {
  return (
    <div className="mx-auto flex max-w-3xl items-center justify-center gap-3 px-4 sm:gap-4 sm:px-6">
      <span className="h-px max-w-[5rem] flex-1 bg-gradient-to-r from-transparent to-violet-400/45 dark:to-violet-300/25" />
      <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500 dark:bg-violet-400" />
        <span className="text-xs font-black uppercase tracking-[0.32em] text-violet-700 dark:text-violet-200/90 sm:text-sm">
          {text}
        </span>
      </span>
      <span className="h-px max-w-[5rem] flex-1 bg-gradient-to-l from-transparent to-violet-400/45 dark:to-violet-300/25" />
    </div>
  );
}

export function HeroMotionOverlay() {
  const symbols: Array<{
    shape: "triangle" | "circle" | "cross" | "square";
    color: string;
    className: string;
    size: number;
    rotate: number;
    duration: number;
    delay: number;
  }> = [
    { shape: "triangle", color: "#34d399", className: "left-[6%] top-8", size: 92, rotate: -8, duration: 7.5, delay: 0 },
    { shape: "circle", color: "#f87171", className: "right-[8%] top-6", size: 80, rotate: 0, duration: 8.5, delay: 1.2 },
    { shape: "cross", color: "#60a5fa", className: "left-[42%] top-2", size: 70, rotate: 12, duration: 6.5, delay: 0.6 },
    { shape: "square", color: "#f472b6", className: "right-[28%] bottom-4", size: 64, rotate: -14, duration: 9, delay: 2 },
  ];

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {symbols.map((s, i) => (
        <span
          key={i}
          className={`ps-float absolute hidden sm:block ${s.className}`}
          style={
            {
              "--ps-rot": `${s.rotate}deg`,
              "--ps-dur": `${s.duration}s`,
              "--ps-delay": `${s.delay}s`,
            } as React.CSSProperties
          }
        >
          <PsGlyph shape={s.shape} color={s.color} size={s.size} />
        </span>
      ))}
    </div>
  );
}

function PsGlyph({
  shape,
  color,
  size,
}: {
  shape: "triangle" | "circle" | "cross" | "square";
  color: string;
  size: number;
}) {
  const stroke = Math.max(2, Math.round(size / 18));
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 64 64",
    fill: "none",
    stroke: color,
    strokeWidth: stroke,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (shape === "triangle") {
    return (
      <svg {...common}>
        <path d="M32 10 L54 50 H10 Z" />
      </svg>
    );
  }
  if (shape === "circle") {
    return (
      <svg {...common}>
        <circle cx="32" cy="32" r="22" />
      </svg>
    );
  }
  if (shape === "cross") {
    return (
      <svg {...common}>
        <path d="M14 14 L50 50 M50 14 L14 50" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect x="12" y="12" width="40" height="40" rx="2" />
    </svg>
  );
}
