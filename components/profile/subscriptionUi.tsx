import { Brain, Gamepad2, Play, Tv } from "lucide-react";

/**
 * Profil → Abunəliklərim kartlarının ortaq hissələri (2026-11 redizayn). Hook YOXDUR — həm server
 * (`SiteSubscriptions`), həm client (`AbunelikClient`) kartı işlədir. Kart qabığı `honsell-glow-card`
 * sinfidir (globals.css — navbar-ın çərçivə + bənövşəyi kölgəsi, blur-suz).
 */

export type SubBrand = "netflix" | "spotify" | "youtube" | "playstation" | "ea" | "linkedin" | "ai" | "streaming";

/** Başlıq/kateqoriyadan brend (CRM `category`: streaming | music | ps | linkedin). */
export function subBrandOf(title: string, category?: string | null): SubBrand {
  const t = title.toLowerCase();
  if (t.includes("netflix")) return "netflix";
  if (t.includes("spotify")) return "spotify";
  if (t.includes("youtube")) return "youtube";
  if (t.includes("ea play")) return "ea";
  if (category === "ps" || t.includes("ps plus") || t.includes("playstation")) return "playstation";
  if (category === "linkedin" || t.includes("linkedin")) return "linkedin";
  return "streaming";
}

const IMG: Partial<Record<SubBrand, string>> = {
  netflix: "/brands/netflix-n.webp",
  spotify: "/brands/spotify.webp",
};

// Rənglər `style`-da: açıq tema `globals.css`-də `.text-white`-ı tündə çevirir, ikon isə ağ qalmalıdır.
const TILE: Record<Exclude<SubBrand, "netflix" | "spotify">, { bg: string; Icon?: typeof Tv; text?: string }> = {
  youtube: { bg: "#ff0033", Icon: Play },
  playstation: { bg: "#0070d1", Icon: Gamepad2 },
  ea: { bg: "#ff4747", Icon: Gamepad2 },
  linkedin: { bg: "#0a66c2", text: "in" },
  ai: { bg: "#7c3aed", Icon: Brain },
  streaming: { bg: "#e11d48", Icon: Tv },
};

export function SubBrandIcon({ brand }: { brand: SubBrand }) {
  const img = IMG[brand];
  if (img) {
    // eslint-disable-next-line @next/next/no-img-element -- 1–3 KB webp
    return <img src={img} alt="" width={48} height={48} decoding="async" className="h-12 w-12 shrink-0 rounded-2xl" />;
  }
  const tile = TILE[brand as keyof typeof TILE];
  const Icon = tile.Icon;
  return (
    <span
      aria-hidden
      className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-lg font-black"
      style={{ background: tile.bg, color: "#ffffff" }}
    >
      {Icon ? <Icon className="h-6 w-6" /> : tile.text}
    </span>
  );
}

export type DaysTone = "ok" | "soon" | "over" | "wait";

const TONE_CLS: Record<DaysTone, string> = {
  ok: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300",
  soon: "bg-amber-500/10 text-amber-700 ring-amber-500/35 dark:text-amber-300",
  over: "bg-rose-500/10 text-rose-700 ring-rose-500/35 dark:text-rose-300",
  wait: "bg-sky-500/10 text-sky-700 ring-sky-500/30 dark:text-sky-300",
};

/**
 * Kartın sağındakı iri göstərici: "4 / gün qalıb", "Bitib", "Hazırlanır". Müştəri ilk baxışda
 * nə qədər vaxtı qaldığını görsün (əvvəl kiçik nişanda idi).
 */
export function DaysLeft({ value, label, tone }: { value: string | null; label: string; tone: DaysTone }) {
  return (
    <div className={`flex min-w-[4.5rem] shrink-0 flex-col items-center justify-center rounded-2xl px-3 py-2 text-center ring-1 ${TONE_CLS[tone]}`}>
      {value != null && <span className="text-2xl font-black leading-none tabular-nums">{value}</span>}
      <span className={`text-[11px] font-bold leading-tight ${value != null ? "mt-1" : ""}`}>{label}</span>
    </div>
  );
}

/** Gün sayından göstərici (sayt abunəlikləri; CRM `status`-u öz funksiyası ilə çevrilir). */
export function daysLeftOf(days: number): { value: string | null; label: string; tone: DaysTone } {
  if (days < 0) return { value: null, label: "Bitib", tone: "over" };
  if (days === 0) return { value: null, label: "Bu gün bitir", tone: "soon" };
  return { value: String(days), label: "gün qalıb", tone: days <= 5 ? "soon" : "ok" };
}

/** dd.mm.yyyy (Asia/Baku, UTC+4) — brauzer/server saat qurşağından asılı deyil. */
export function fmtBakuDate(input: string | Date | null): string {
  if (!input) return "—";
  const t = typeof input === "string" ? Date.parse(input) : input.getTime();
  if (Number.isNaN(t)) return "—";
  const d = new Date(t + 4 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}.${p(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
}
