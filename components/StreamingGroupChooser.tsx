import Link from "next/link";
import { ArrowRight, Check, KeyRound, UserRound } from "lucide-react";
import type { StreamingGroupChoice } from "@/lib/streamingGroups";

export type StreamingGroupChoicePricing = {
  accent: StreamingGroupChoice["accent"];
  fromPerMonthAzn: number | null;
  plans: Array<{
    name: string;
    fromPerMonthAzn: number | null;
    href: string;
    note?: string | null;
  }>;
};

function choiceHref(c: StreamingGroupChoice, basePath: string) {
  return c.platformSlug ? `/streaming/${c.platformSlug}` : `${basePath}?secim=${c.selection ?? ""}`;
}

/** Birinci addım: iki seçim və qısa fərq. Paketlər növbəti addımdadır. */
export default function StreamingGroupChooser({
  serviceLabel,
  basePath,
  choices,
  pricing,
}: {
  serviceLabel: string;
  basePath: string;
  choices: StreamingGroupChoice[];
  pricing?: StreamingGroupChoicePricing[];
}) {
  return (
    // Eni səhifə konteyneridir (navbar/footer ilə eyni kənar).
    <div>
      <h2 className="text-center text-3xl font-black text-white sm:text-4xl">
        {serviceLabel}-i necə istəyirsən?
      </h2>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {choices.map((choice) => {
          const isAccount = choice.accent === "hesab";
          const Icon = isAccount ? UserRound : KeyRound;
          const from = pricing?.find((p) => p.accent === choice.accent)?.fromPerMonthAzn ?? null;
          return (
            <Link
              key={choice.title}
              href={choiceHref(choice, basePath)}
              className={`group flex flex-col rounded-3xl border bg-zinc-950 p-6 transition hover:bg-zinc-900 ${
                isAccount ? "border-zinc-200 dark:border-white/10 hover:border-violet-400/60" : "border-zinc-200 dark:border-white/10 hover:border-violet-400/60"
              }`}
            >
              <span
                className={`grid h-12 w-12 place-items-center rounded-2xl ${
                  "bg-violet-500/15 text-violet-700 dark:text-violet-200"
                }`}
              >
                <Icon className="h-6 w-6" />
              </span>

              <h3 className="mt-4 text-2xl font-black leading-tight text-white">{choice.title}</h3>
              <p className="mt-1 text-sm text-zinc-400">{choice.subtitle}</p>

              <ul className="mt-5 flex-1 space-y-2.5">
                {choice.points.map((point) => (
                  <li key={point} className="flex items-start gap-2 text-sm font-medium text-zinc-200">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    {point}
                  </li>
                ))}
              </ul>

              <div className="mt-6 flex items-center justify-between gap-3 border-t border-zinc-200 dark:border-white/10 pt-4">
                <span className="text-sm text-zinc-400">
                  {from == null ? (
                    "Tezliklə"
                  ) : (
                    <>
                      Ayda <span className="text-lg font-black text-white">{from.toFixed(2)} ₼</span>-dan
                    </>
                  )}
                </span>
                <span className="inline-flex items-center gap-1.5 text-sm font-black text-white">
                  Paketlər
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
