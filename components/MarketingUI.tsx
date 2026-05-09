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
    <div className="rounded-[28px] border border-white/10 bg-[#0F0817] p-5 sm:p-6">
      <div className="mb-5 flex items-center gap-3">
        <span className={`grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-gradient-to-br backdrop-blur-sm ${accentClass}`}>
          {icon}
        </span>
        <div>
          <h3 className="text-xl font-black tracking-tight text-white sm:text-2xl">{label}</h3>
          {description && <p className="text-xs text-zinc-400 sm:text-sm">{description}</p>}
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
      className="group relative flex min-h-[140px] overflow-hidden rounded-2xl border border-white/10 bg-[#150A21] p-4 transition hover:-translate-y-0.5 hover:border-indigo-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#A78BFA]/60"
    >
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt=""
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1280px) 33vw, 16vw"
          className="object-cover opacity-25 saturate-125 transition duration-500 group-hover:scale-105 group-hover:opacity-35"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#201032] via-[#150A21] to-[#0A0A0F]" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0F0817] via-[#0F0817]/80 to-[#0F0817]/30" />

      <div className="relative z-10 flex flex-1 flex-col justify-between">
        <div className="flex items-start justify-between gap-3">
          <span className={`grid h-9 w-9 place-items-center rounded-xl border bg-gradient-to-br text-white backdrop-blur-sm ${accentClass}`}>
            {icon}
          </span>
          <ArrowRight className="h-4 w-4 text-white/40 transition group-hover:translate-x-1 group-hover:text-white" />
        </div>
        <div>
          <h4 className="text-base font-bold leading-tight text-white">{label}</h4>
          <p className="mt-1 text-xs text-zinc-300">{sub}</p>
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
      className="group relative flex min-h-[210px] overflow-hidden rounded-[24px] border border-white/10 bg-[#150A21] p-5 shadow-2xl transition hover:-translate-y-1 hover:border-indigo-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#A78BFA]/60"
    >
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt=""
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1280px) 33vw, 16vw"
          className="object-cover opacity-20 saturate-125 transition duration-700 group-hover:scale-105 group-hover:opacity-25"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#201032] via-[#150A21] to-[#0A0A0F]" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-[#150A21] via-[#150A21]/85 to-[#150A21]/35" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(167,139,250,0.20),transparent_34%)] opacity-80" />

      <div className="relative z-10 flex flex-1 flex-col justify-between">
        <div className="flex items-start justify-between gap-4">
          <span className={`grid h-11 w-11 place-items-center rounded-2xl border bg-gradient-to-br backdrop-blur-sm ${accentClass}`}>
            {icon}
          </span>
          {badge && (
            <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-200 ring-1 ring-amber-300/30">
              {badge}
            </span>
          )}
        </div>
        <div>
          <h3 className="text-lg font-black leading-tight text-white">{label}</h3>
          <p className="mt-2 min-h-[42px] text-sm leading-relaxed text-zinc-300">{sub}</p>
          <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-[#A78BFA] transition group-hover:text-white">
            Keçid et <ArrowRight className="h-4 w-4" />
          </span>
        </div>
      </div>
    </Link>
  );
}

export function MarqueeHeader({ text }: { text: string }) {
  const content = Array.from({ length: 15 }).map((_, i) => (
    <span key={i} className="mx-4 text-2xl font-bold tracking-[0.2em] text-white uppercase sm:text-4xl">
      {text} <span className="mx-4 text-white/30">•</span>
    </span>
  ));

  const duration = Math.max(text.length * 4, 30);

  return (
    <div className="relative flex w-full overflow-hidden border-y border-white/10 bg-[#12081C] py-5">
      <div className="flex whitespace-nowrap" style={{ animation: `marquee ${duration}s linear infinite` }}>
        <style>{`
          @keyframes marquee {
            from { transform: translateX(0); }
            to   { transform: translateX(-50%); }
          }
        `}</style>
        {content}
        {content}
      </div>
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
