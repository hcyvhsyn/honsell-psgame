"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ImageOff } from "lucide-react";
import { cdnImageUrl } from "@/lib/cdnImage";

/**
 * Bütün məhsul kartları üçün vahid şəkil komponenti.
 *
 * Niyə lazımdır:
 *   1. `next/image` uzaq URL 404/şəbəkə xətası verəndə səssizcə boş qutu qoyur
 *      → kart "qırıq" görünür. Burada `onError` brendə uyğun placeholder-a keçir.
 *   2. Yüklənənə qədər konteyner qapqara qalıb sonra şəkil "pop" edirdi — bu
 *      keyfiyyətsiz hiss yaradırdı. İndi yüklənənə qədər animasiyalı **shimmer
 *      skeleton** göstərilir, şəkil hazır olanda **yumşaq fade-in** ilə açılır.
 *   3. `cdnImageUrl()` ilə Supabase → CDN yönləndirməsini avtomatik tətbiq edir.
 *
 * ⚠️ İSTİFADƏ QAYDASI — konteyner `position: relative` OLMALIDIR.
 * Bu komponent `next/image`-i `fill` ilə render edir (`position: absolute;
 * inset: 0`) və öz konteynerini YARATMIR. Ata elementdə `relative` yoxdursa
 * şəkil ən yaxın pozisiyalı ata elementə yapışır və o blokun bütün
 * məzmununu örtür — məsələn modalın içindəki mətn və düymələr görünməz olur.
 *
 * Düzgün:  <div className="relative h-20 w-16 overflow-hidden">
 *            <ProductImage src={...} alt={...} className="h-full w-full object-cover" />
 *          </div>
 */
export default function ProductImage({
  src,
  alt,
  sizes,
  priority = false,
  className = "object-cover",
  imgClassName,
  fallback,
  badge,
}: {
  src: string | null | undefined;
  alt: string;
  sizes?: string;
  priority?: boolean;
  /** Şəkil <img>-inə tətbiq olunur (object-cover / object-contain və s.). */
  className?: string;
  /** className üçün alias (geriyə uyğunluq). */
  imgClassName?: string;
  /** Tam fərdi placeholder node-u (verilməyibsə standart premium placeholder). */
  fallback?: ReactNode;
  /** Standart placeholder altında göstəriləcək qısa etiket (məs. kateqoriya). */
  badge?: string;
}) {
  const resolved = src ? cdnImageUrl(src) : null;
  const [status, setStatus] = useState<"loading" | "loaded" | "error">(
    resolved ? "loading" : "error",
  );
  const imgRef = useRef<HTMLImageElement>(null);
  const imageClass = imgClassName ?? className;

  // Keşdən gələn şəkildə `onLoad` React handler bağlanmamış işə düşə bilər →
  // şəkil opacity-0-da ilişməsin deyə mount-da `complete` yoxlayırıq.
  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
      setStatus("loaded");
    }
  }, []);

  if (!resolved || status === "error") {
    if (fallback) return <>{fallback}</>;
    return (
      <div className="grid h-full w-full place-items-center bg-[radial-gradient(circle_at_30%_20%,rgba(139,92,246,0.18),transparent_60%),linear-gradient(135deg,rgba(124,58,237,0.10),rgba(24,24,27,0.04))] text-violet-500/70 dark:text-violet-300/60">
        <div className="flex flex-col items-center gap-2 px-2 text-center">
          <span className="grid h-11 w-11 place-items-center rounded-2xl border border-violet-300/40 bg-white/70 shadow-sm dark:border-white/10 dark:bg-white/10">
            <ImageOff className="h-5 w-5" />
          </span>
          {badge && (
            <span className="max-w-[9rem] truncate text-[10px] font-black uppercase tracking-[0.14em]">
              {badge}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      {status === "loading" && (
        <span aria-hidden className="honsell-img-skeleton absolute inset-0" />
      )}
      <Image
        ref={imgRef}
        src={resolved}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        // Şəkillər artıq cdn.honsell.store (Cloudflare) arxasında keşlənir.
        // Bir də self-hosted Next optimizer-indən (/_next/image, sharp) keçirmək
        // scroll burst-ında request-ləri növbəyə salıb 5-7s pending yaradırdı.
        // `unoptimized` ilə brauzer birbaşa CDN-dən paralel çəkir → blokaj yoxdur.
        unoptimized
        className={`${imageClass} transition-opacity duration-500 ease-out ${
          status === "loaded" ? "opacity-100" : "opacity-0"
        }`}
        onLoad={() => setStatus("loaded")}
        onError={() => setStatus("error")}
      />
    </>
  );
}
