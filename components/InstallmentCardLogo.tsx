import Image from "next/image";
import { installmentCardLogo } from "@/lib/installmentsShared";

/**
 * Taksit kartının bank loqosu — ağ fon üzərində: tam.kart qara, bolkart tünd
 * göy rəngdədir və səbətin tünd fonunda oxunmur. Loqo faylları 3:1 nisbətindədir
 * (public/bank/). Loqosu olmayan kart adı ilə mətn kimi göstərilir.
 */
export default function InstallmentCardLogo({
  name,
  heightPx = 18,
}: {
  name: string;
  heightPx?: number;
}) {
  const src = installmentCardLogo(name);
  if (!src) {
    return <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{name}</span>;
  }
  return (
    <span className="inline-flex shrink-0 items-center rounded-md bg-white px-1.5 py-1 ring-1 ring-black/5">
      <Image
        src={src}
        alt={name}
        width={heightPx * 3}
        height={heightPx}
        style={{ height: heightPx, width: "auto" }}
        className="object-contain"
      />
    </span>
  );
}
