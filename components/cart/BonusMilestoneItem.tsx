"use client";

import { CheckCircle, Sparkles, Lock } from "lucide-react";

export type MilestoneStatus = "done" | "active" | "locked";

export type BonusMilestone = {
  id: string;
  title: string;
  reward: string;
  status: MilestoneStatus;
  /** 0..1 irəliləyiş (yalnız amount milestone-larda göstərilir). */
  progress: number;
  /** Davam edən mərhələdə istifadəçiyə göstərilən mesaj. */
  message: string;
};

export default function BonusMilestoneItem({ m }: { m: BonusMilestone }) {
  const tone =
    m.status === "done"
      ? { icon: CheckCircle, box: "border-emerald-500/25 bg-emerald-500/5", accent: "text-emerald-300", bar: "bg-emerald-500" }
      : m.status === "active"
        ? { icon: Sparkles, box: "border-fuchsia-500/25 bg-fuchsia-500/5", accent: "text-fuchsia-300", bar: "bg-fuchsia-500" }
        : { icon: Lock, box: "border-zinc-700/60 bg-zinc-950/30", accent: "text-zinc-400", bar: "bg-zinc-600" };
  const Icon = tone.icon;

  return (
    <div className={`rounded-xl border px-3 py-2.5 ${tone.box}`}>
      <div className="flex items-start gap-2">
        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone.accent}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-zinc-200">{m.title}</span>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${tone.accent}`}>
              {m.reward}
            </span>
          </div>
          <p className={`mt-0.5 text-[11px] leading-snug ${m.status === "done" ? "text-emerald-200/90" : "text-zinc-400"}`}>
            {m.message}
          </p>
          {m.status !== "done" && m.progress > 0 && (
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-zinc-800">
              <div
                className={`h-full rounded-full transition-all ${tone.bar}`}
                style={{ width: `${Math.min(100, Math.round(m.progress * 100))}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
