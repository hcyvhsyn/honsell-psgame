"use client";

import { useState } from "react";
import { MessageSquarePlus, MessageSquareWarning } from "lucide-react";
import WhatsappReviewsAdminClient from "./WhatsappReviewsAdminClient";
import WinbackAdminClient from "./WinbackAdminClient";

type ProductOption = { id: string; title: string; priceAzn: number; type: string };

type Tab = "reviews" | "winback";

const TABS: { key: Tab; label: string; icon: typeof MessageSquarePlus }[] = [
  { key: "reviews", label: "Rəy dəvəti", icon: MessageSquarePlus },
  { key: "winback", label: "Abunəliyi bitənlər", icon: MessageSquareWarning },
];

export default function WhatsappAdminTabs({ products }: { products: ProductOption[] }) {
  const [tab, setTab] = useState<Tab>("reviews");

  return (
    <div className="space-y-6">
      <div className="flex gap-1 rounded-xl border border-admin-line bg-admin-chip/40 p-1">
        {TABS.map(({ key, label, icon: Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                active
                  ? "bg-violet-600 text-white shadow-sm"
                  : "text-zinc-600 hover:bg-admin-chip2 dark:text-zinc-300"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          );
        })}
      </div>

      {tab === "reviews" ? (
        <div>
          <p className="mb-4 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Abunəliyini WhatsApp-dan alan müştərilər üçün. Müştərinin aldığı məhsulu seçin,
            telefon nömrəsini yazın — sistem WhatsApp-a rəy linki göndərir. Nömrə bazada varsa,
            müştəri avtomatik tanınır (təkrar qeydiyyat olmur, sadəcə rəy yazır). Qeyd edilən hər
            satış anasayfadakı sifariş sayı və “ən çox alınanlar”a əlavə olunur.
          </p>
          <WhatsappReviewsAdminClient products={products} />
        </div>
      ) : (
        <div>
          <p className="mb-4 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Abunəliyi bitib davam etməyən müştərilər üçün. Aldığı məhsulu seçin, telefon nömrəsini
            yazın — sistem WhatsApp-a qısa sorğu göndərir: <span className="font-medium">niyə davam
            etmədin?</span> Müştəri hazır səbəbdən birini seçir və istəsə şərh yazır. Cavablar aşağıda
            görünür. Bu bölmə satış qeyd etmir — yalnız geribildirim toplayır.
          </p>
          <WinbackAdminClient products={products} />
        </div>
      )}
    </div>
  );
}
