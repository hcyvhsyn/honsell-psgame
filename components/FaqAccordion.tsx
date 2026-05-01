"use client";

import { useState } from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

const FAQS = [
  { q: "Ödəniş necə aparılır?", a: "Cüzdan balansınızı bank köçürməsi ilə artırırsınız (admin kart nömrəsini göstərir), sonra alışlarınızı birbaşa cüzdandan ödəyirsiniz." },
  { q: "TRY gift kartın kodu nə vaxt gəlir?", a: "Ödəniş uğurla başa çatdıqdan dərhal sonra — kodu anında profilinizin 'Sifarişlərim' bölməsindən görə bilərsiniz." },
  { q: "PS Plus sifarişim nə vaxt icra olunur?", a: "PS Plus sifarişləri admin tərəfindən manual icra edilir. Adətən 1 iş saatı ərzində tamamlanır." },
  { q: "Türkiyə PSN hesabı niyə lazımdır?", a: "Türkiyə PS Store-da oyunlar, DLC-lər və abunəliklər AZN-ə görə daha əlverişli qiymətlərlə mövcuddur." },
  { q: "Referal proqramı necə işləyir?", a: "Unikal referal kodunuzu dostlarınızla paylaşın. Hər alışlarında sizə xüsusi bonus hesablanır." },
  { q: "Sifariş səhv getsə nə baş verir?", a: "Admin sifarişi tamamlaya bilməsə, ödənilmiş məbləğ cüzdanınıza avtomatik geri qaytarılır." },
];

export default function FaqAccordion() {
  const [open, setOpen] = useState<number | null>(null);
  
  return (
    <div className="flex flex-col">
      {FAQS.map((f, i) => (
        <div key={i} className="border-b border-white/10 last:border-0">
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="group flex w-full items-center justify-between py-6 text-left transition-colors"
          >
            <span className={`text-xl font-medium sm:text-2xl ${open === i ? "text-white" : "text-zinc-100 group-hover:text-white"}`}>
              {f.q}
            </span>
            {open === i ? (
              <ArrowDownRight className="h-5 w-5 shrink-0 text-white transition-transform" />
            ) : (
              <ArrowUpRight className="h-5 w-5 shrink-0 text-zinc-400 group-hover:text-white transition-transform" />
            )}
          </button>
          <div
            className={`grid transition-all duration-300 ease-in-out ${
              open === i ? "grid-rows-[1fr] pb-6 opacity-100" : "grid-rows-[0fr] opacity-0"
            }`}
          >
            <div className="overflow-hidden">
              <p className="text-sm leading-relaxed text-zinc-400 sm:text-base">
                {f.a}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
