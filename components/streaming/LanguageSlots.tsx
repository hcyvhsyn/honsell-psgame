/**
 * Dublyaj / Altyazı sətirləri — HƏMİŞƏ eyni 3 slot (TR · RU · EN), üç vəziyyət:
 *   tam     — dolu çip
 *   qismən  — kəsik sərhəd + yarım dairə (bəzi epizodlarda)
 *   yoxdur  — sönük, üstündən xətt
 * Hook yoxdur — həm client kartda, həm server detal səhifəsində işlənir.
 */
import {
  KIND_NAME_AZ,
  LANG_SHORT,
  slotTooltip,
  type LangKind,
  type LangState,
  type LanguageSlot,
} from "@/lib/streamingLanguageStates";

/** `overlay` — kartda posterin tünd qradienti üzərində (tema dəyişmir);
 *  `auto` — səhifədə, light/dark temaya uyğun (`dark:` variantları). */
export type ChipTone = "overlay" | "auto";

const FILLED: Record<ChipTone, Record<LangKind, string>> = {
  overlay: {
    dub: "border-indigo-300/50 bg-indigo-500/85 text-white",
    sub: "border-emerald-300/50 bg-emerald-500/80 text-[#04130d]",
  },
  auto: {
    dub: "border-indigo-600 bg-indigo-600 text-[#ffffff] dark:border-indigo-400/60 dark:bg-indigo-500/85",
    sub: "border-emerald-600 bg-emerald-600 text-[#ffffff] dark:border-emerald-300/50 dark:bg-emerald-500/80 dark:text-[#04130d]",
  },
};
const OUTLINE: Record<ChipTone, Record<LangKind, string>> = {
  overlay: {
    dub: "border-dashed border-indigo-300/80 bg-indigo-500/15 text-white",
    sub: "border-dashed border-emerald-300/80 bg-emerald-500/15 text-white",
  },
  auto: {
    dub: "border-dashed border-indigo-500 bg-indigo-50 text-indigo-800 dark:border-indigo-300/80 dark:bg-indigo-500/15 dark:text-indigo-100",
    sub: "border-dashed border-emerald-600 bg-emerald-50 text-emerald-800 dark:border-emerald-300/80 dark:bg-emerald-500/15 dark:text-emerald-100",
  },
};
const NONE: Record<ChipTone, string> = {
  overlay: "border-white/10 bg-black/30 text-white/35 line-through decoration-white/40",
  auto: "border-zinc-300 bg-transparent text-zinc-400 line-through dark:border-white/10 dark:text-white/35",
};
const ROW_LABEL: Record<ChipTone, Record<LangKind, string>> = {
  overlay: { dub: "text-indigo-200", sub: "text-emerald-200" },
  auto: { dub: "text-indigo-700 dark:text-indigo-300", sub: "text-emerald-700 dark:text-emerald-300" },
};

/** Yarım dolu dairə — "bəzi epizodlarda" işarəsi (legend-də də eyni element). */
export function PartialMark({ kind, className = "" }: { kind: LangKind; className?: string }) {
  // Orta ton (indigo-500 / emerald-500) — həm açıq, həm tünd fonda görünür.
  const color = kind === "dub" ? "rgb(99 102 241)" : "rgb(16 185 129)";
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-2 w-2 shrink-0 rounded-full border ${className}`}
      style={{ borderColor: color, background: `linear-gradient(90deg, ${color} 50%, transparent 50%)` }}
    />
  );
}

export function LanguageChip({ slot, size = "sm", tone = "overlay" }: { slot: LanguageSlot; size?: "sm" | "md"; tone?: ChipTone }) {
  const base = size === "md" ? "h-8 min-w-[3.25rem] px-2.5 text-xs" : "h-6 min-w-[2.6rem] px-1.5 text-[10px]";
  const style: Record<LangState, string> = {
    full: FILLED[tone][slot.kind],
    partial: OUTLINE[tone][slot.kind],
    none: NONE[tone],
  };
  return (
    <span
      className={`inline-flex items-center justify-center gap-1 rounded-full border font-extrabold uppercase backdrop-blur-md ${base} ${style[slot.state]}`}
      title={slotTooltip(slot)}
      aria-label={slotTooltip(slot)}
    >
      {slot.state === "partial" ? <PartialMark kind={slot.kind} /> : null}
      {LANG_SHORT[slot.code]}
    </span>
  );
}

export function LanguageRows({
  slots,
  size = "sm",
  tone = "overlay",
  showLegend = true,
}: {
  slots: Record<LangKind, LanguageSlot[]>;
  size?: "sm" | "md";
  tone?: ChipTone;
  showLegend?: boolean;
}) {
  const anyPartial = [...slots.dub, ...slots.sub].some((s) => s.state === "partial");
  const label = size === "md" ? "w-20 text-xs" : "w-[3.4rem] text-[10px]";
  return (
    <div className="space-y-1.5">
      {(["dub", "sub"] as const).map((kind) => (
        <div key={kind} className="flex items-center gap-1.5">
          <span className={`${label} shrink-0 font-black uppercase tracking-wide ${ROW_LABEL[tone][kind]}`}>
            {KIND_NAME_AZ[kind]}
          </span>
          <div className="flex flex-wrap gap-1">
            {slots[kind].map((s) => (
              <LanguageChip key={`${kind}-${s.code}`} slot={s} size={size} tone={tone} />
            ))}
          </div>
        </div>
      ))}
      {showLegend && anyPartial ? (
        <p className={`flex items-center gap-1.5 font-semibold ${tone === "auto" ? "text-zinc-500" : "text-white/60"} ${size === "md" ? "text-xs" : "text-[10px]"}`}>
          <PartialMark kind="dub" /> bəzi epizodlarda
        </p>
      ) : null}
    </div>
  );
}
