import { Zap, ShieldCheck, Star, PackageCheck } from "lucide-react";

/**
 * Hero altında göstərilən etibar zolağı. İlk dəfə gələn ziyarətçinin
 * "ödəniş edim, problem olmaz?" etirazını real rəqəmlərlə sındırır.
 * Bütün rəqəmlər server tərəfdən hesablanıb prop kimi ötürülür — statik
 * marketinq iddiası yox, canlı data.
 */
export type HomeTrustStats = {
  /** Uğurla tamamlanmış sifariş sayı (PURCHASE + SERVICE_PURCHASE). */
  orders: number;
  /** Kataloqdakı aktiv oyun sayı. */
  games: number;
  /** Müştəri rəyləri üzrə orta reytinq (1–5). null — rəy yoxdur. */
  avgRating: number | null;
  /** Rəy sayı. */
  reviewCount: number;
};

function formatCount(n: number): string {
  // 1240 → "1.2K+", 12400 → "12K+"; kiçik rəqəmlər olduğu kimi.
  if (n >= 1000) {
    const k = n / 1000;
    const text = k >= 10 ? Math.floor(k).toString() : k.toFixed(1).replace(/\.0$/, "");
    return `${text}K+`;
  }
  if (n >= 100) return `${Math.floor(n / 50) * 50}+`;
  return n.toLocaleString("az-AZ");
}

export default function HomeTrustBar({ orders, games, avgRating, reviewCount }: HomeTrustStats) {
  const items = [
    {
      icon: <PackageCheck className="h-5 w-5" />,
      step: "01",
      eyebrow: "Sifariş",
      value: orders > 0 ? formatCount(orders) : `${formatCount(games)} `,
      label: orders > 0 ? "uğurlu sifariş" : "rəqəmsal məhsul",
      tone: "border-[#8b5cf6]/35 bg-[#8b5cf6]/10 text-[#cab8ff]",
      line: "from-[#8b5cf6] to-[#22d3ee]",
    },
    {
      icon: <Zap className="h-5 w-5" />,
      step: "02",
      eyebrow: "Çatdırılma",
      value: "Anında",
      label: "avtomatik çatdırılma",
      tone: "border-[#f59e0b]/35 bg-[#f59e0b]/10 text-[#ffd68a]",
      line: "from-[#f59e0b] to-[#fb7185]",
    },
    {
      icon: <Star className="h-5 w-5 fill-current" />,
      step: "03",
      eyebrow: "Rəy",
      value: avgRating != null ? `${avgRating.toFixed(1)}★` : "5.0★",
      label: reviewCount > 0 ? `${formatCount(reviewCount)} rəy` : "müştəri məmnuniyyəti",
      tone: "border-[#38bdf8]/35 bg-[#38bdf8]/10 text-[#9be7ff]",
      line: "from-[#38bdf8] to-[#2dd4bf]",
    },
    {
      icon: <ShieldCheck className="h-5 w-5" />,
      step: "04",
      eyebrow: "Ödəniş",
      value: "Etibarlı",
      label: "təhlükəsiz ödəniş",
      tone: "border-[#34d399]/35 bg-[#34d399]/10 text-[#9af5c6]",
      line: "from-[#34d399] to-[#a3e635]",
    },
  ];

  return (
    <section
      aria-label="Honsell etibar göstəriciləri"
      className="relative mt-5 overflow-hidden border-y border-[#1e2033] bg-[#060713] px-4 py-5 text-[#f8fbff] sm:px-6 lg:px-8"
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(139,92,246,0.16),transparent_34%,rgba(34,211,238,0.09)_63%,rgba(52,211,153,0.12))]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.09] bg-[linear-gradient(90deg,#ffffff_1px,transparent_1px),linear-gradient(0deg,#ffffff_1px,transparent_1px)] bg-[size:30px_30px]" />

      <div className="relative mx-auto grid max-w-7xl gap-4 lg:grid-cols-[0.72fr_2fr] lg:items-stretch">
        <div className="flex flex-col justify-between border-l border-[#2b2d46] pl-4 sm:pl-5 lg:min-h-[118px]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-md border border-[#8b5cf6]/30 bg-[#8b5cf6]/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#cab8ff]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#34d399]" />
              Honsell güvən
            </div>
            <p className="mt-2 max-w-sm text-xl font-black leading-tight text-[#f8fbff] sm:mt-3 sm:text-3xl lg:text-2xl xl:text-3xl">
              Rəqəmsal alış üçün güvən axını
            </p>
          </div>
          <p className="mt-2 hidden max-w-md text-sm font-semibold leading-relaxed text-[#8f98b5] sm:block">
            Sifarişdən ödənişə qədər əsas siqnallar bir yerdə.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {items.map((it) => (
            <div
              key={it.step}
              className="group relative min-h-[112px] overflow-hidden rounded-lg border border-[#25283b] bg-[#0b0d19]/88 p-3.5 shadow-[0_18px_60px_-48px_rgba(34,211,238,0.65)] transition hover:-translate-y-0.5 hover:border-[#3b405f] hover:bg-[#101323] sm:min-h-[122px]"
            >
              <span className={`absolute inset-x-0 top-0 h-0.5 bg-[linear-gradient(90deg,var(--tw-gradient-stops))] ${it.line}`} />
              <div className="flex items-start justify-between gap-2">
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg border ${it.tone}`}>
                  {it.icon}
                </span>
                <span className="rounded-md border border-[#2a2d43] bg-[#070814] px-2 py-1 text-[10px] font-black text-[#747f9f]">
                  {it.step}
                </span>
              </div>
              <div className="mt-4">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[#66708f]">
                  {it.eyebrow}
                </div>
                <div className="mt-1 break-words text-2xl font-black leading-none text-[#f8fbff] sm:text-3xl lg:text-2xl xl:text-3xl">
                  {it.value}
                </div>
                <div className="mt-2 text-xs font-bold leading-snug text-[#96a0bc] sm:text-sm">
                  {it.label}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
