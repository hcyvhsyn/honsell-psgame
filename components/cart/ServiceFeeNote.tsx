import { Info } from "lucide-react";
import { CART_SERVICE_FEE_PCT } from "@/lib/cartServiceFee";

/**
 * Səbət xidmət haqqının (lib/cartServiceFee.ts) ƏVVƏLCƏDƏN göstərilməsi.
 * Əvvəl müştəri məhsulda 23.04 ₼ görüb səbətdə birdən 23.73 ₼ ilə qarşılaşırdı.
 * Hook yoxdur — server və client komponentlərində işləyir.
 */
export default function ServiceFeeNote({ className = "" }: { className?: string }) {
  return (
    <p className={`flex items-start gap-1.5 text-xs leading-snug text-zinc-500 dark:text-zinc-400 ${className}`}>
      <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>Ödəniş zamanı {CART_SERVICE_FEE_PCT}% xidmət haqqı əlavə olunur.</span>
    </p>
  );
}
