import { Package } from "lucide-react";

import LootBoxHistory from "@/components/profile/LootBoxHistory";

export const dynamic = "force-dynamic";

export default function ProfileLootBoxesPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-black">
          <Package className="h-6 w-6 text-amber-500" /> Qutu açılışları
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Açdığınız qutular və qazandığınız hədiyyələr. Seçim gözləyən hədiyyəni oyun kimi götürə
          və ya balansa sata bilərsiniz.
        </p>
      </div>
      <LootBoxHistory />
    </div>
  );
}
