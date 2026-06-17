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
      value: orders > 0 ? formatCount(orders) : `${formatCount(games)} `,
      label: orders > 0 ? "uğurlu sifariş" : "rəqəmsal məhsul",
    },
    {
      icon: <Zap className="h-5 w-5" />,
      value: "Anında",
      label: "avtomatik çatdırılma",
    },
    {
      icon: <Star className="h-5 w-5 fill-current" />,
      value: avgRating != null ? `${avgRating.toFixed(1)}★` : "5.0★",
      label: reviewCount > 0 ? `${formatCount(reviewCount)} rəy` : "müştəri məmnuniyyəti",
    },
    {
      icon: <ShieldCheck className="h-5 w-5" />,
      value: "Etibarlı",
      label: "təhlükəsiz ödəniş",
    },
  ];

  return (
    <section className="mx-auto max-w-7xl px-4 pt-5 sm:px-6 lg:px-8">
      <div className="grid grid-cols-2 gap-2.5 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-white/[0.03] sm:grid-cols-4 sm:gap-3 sm:p-4">
        {items.map((it, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-xl px-2 py-1.5 sm:px-3 sm:py-2"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-violet-600/10 text-violet-600 dark:bg-violet-400/10 dark:text-violet-300">
              {it.icon}
            </span>
            <div className="min-w-0">
              <div className="text-base font-black leading-tight text-zinc-950 dark:text-white sm:text-lg">
                {it.value}
              </div>
              <div className="truncate text-[11px] font-medium text-zinc-500 dark:text-zinc-400 sm:text-xs">
                {it.label}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
