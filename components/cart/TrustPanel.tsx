"use client";

import {
  ShieldCheck,
  BadgeCheck,
  CreditCard,
  MessageCircle,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

/**
 * Güvən paneli — statik məlumat (gələcəkdə admin paneldən idarə üçün array
 * strukturunda). Ödənişdən əvvəl Honsell-ə etimadı artırır. Mobil-də kompakt.
 */
type TrustItem = { id: string; icon: LucideIcon; title: string; description?: string };

const TRUST_ITEMS: TrustItem[] = [
  { id: "years", icon: ShieldCheck, title: "5 ildir fəaliyyət göstəririk" },
  { id: "tax", icon: BadgeCheck, title: "Rəsmi vergi ödəyicisiyik" },
  { id: "pay", icon: CreditCard, title: "Kart · Apple Pay · Google Pay ödəniş" },
  { id: "whatsapp", icon: MessageCircle, title: "Aktivləşmə WhatsApp üzərindən" },
  { id: "digital", icon: Sparkles, title: "Digital məhsul satışı üzrə ixtisaslıyıq" },
];

export default function TrustPanel() {
  return (
    <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold tracking-tight text-zinc-100">Niyə Honsell?</h3>
        <span className="text-[11px] text-emerald-300">Təhlükəsiz checkout</span>
      </div>

      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
        {TRUST_ITEMS.map((it) => {
          const Icon = it.icon;
          return (
            <li
              key={it.id}
              className="flex items-start gap-2 rounded-xl border border-zinc-800/60 bg-zinc-950/35 px-3 py-2.5 text-xs text-zinc-300"
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              <div className="min-w-0 leading-snug">
                <span>{it.title}</span>
                {it.description && (
                  <span className="block text-[11px] text-zinc-500">{it.description}</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
