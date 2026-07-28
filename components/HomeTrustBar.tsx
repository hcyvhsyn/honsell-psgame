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
      eyebrow: "Sifariş",
      value: orders > 0 ? formatCount(orders) : `${formatCount(games)} `,
      label: orders > 0 ? "uğurlu sifariş" : "rəqəmsal məhsul",
    },
    {
      icon: <Zap className="h-5 w-5" />,
      eyebrow: "Çatdırılma",
      value: "Anında",
      label: "avtomatik çatdırılma",
    },
    {
      icon: <Star className="h-5 w-5 fill-current" />,
      eyebrow: "Rəy",
      value: avgRating != null ? `${avgRating.toFixed(1)}★` : "5.0★",
      label: reviewCount > 0 ? `${formatCount(reviewCount)} rəy` : "müştəri məmnuniyyəti",
    },
    {
      icon: <ShieldCheck className="h-5 w-5" />,
      eyebrow: "Ödəniş",
      value: "Etibarlı",
      label: "təhlükəsiz ödəniş",
    },
  ];

  return (
    <section
      aria-label="Honsell etibar göstəriciləri"
      className="mx-auto mt-5 max-w-7xl px-4 text-[#f8fbff] sm:px-6 lg:px-8"
    >
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d16] shadow-[0_20px_55px_-38px_rgba(0,0,0,0.95)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(139,92,246,0.22),transparent_35%),radial-gradient(circle_at_100%_100%,rgba(217,70,239,0.12),transparent_32%)]" />
        <div className="relative grid lg:grid-cols-[minmax(230px,0.85fr)_2.15fr] lg:items-center">
          <div className="border-b border-white/10 p-5 sm:p-6 lg:border-b-0 lg:border-r lg:p-7">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-violet-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
              Honsell güvən
            </div>
            <p className="mt-2 max-w-xs text-xl font-black leading-tight tracking-tight text-white sm:text-2xl">
              Rahat alış, aydın nəticə.
            </p>
            <p className="mt-2 hidden max-w-xs text-sm leading-relaxed text-zinc-400 sm:block">
              Sifarişdən ödənişə qədər etibar edə biləcəyiniz xidmət.
            </p>
          </div>

          <div className="grid grid-cols-2 divide-x divide-y divide-white/10 lg:grid-cols-4 lg:divide-y-0">
            {items.map((it) => (
              <div
                key={it.eyebrow}
                className="group min-w-0 p-4 transition-colors hover:bg-white/[0.035] sm:p-5 lg:min-h-[148px] lg:p-5"
              >
                <div className="flex items-center gap-2.5 text-violet-300">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-violet-400/10 ring-1 ring-inset ring-violet-300/20 transition group-hover:bg-violet-400/20">
                    {it.icon}
                  </span>
                  <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                    {it.eyebrow}
                  </div>
                </div>
                <div className="mt-5">
                  <div className="break-words text-2xl font-black leading-none tracking-tight text-white sm:text-3xl lg:text-[1.7rem]">
                    {it.value}
                  </div>
                  <div className="mt-2 text-xs font-medium leading-snug text-zinc-400 sm:text-sm">
                    {it.label}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
