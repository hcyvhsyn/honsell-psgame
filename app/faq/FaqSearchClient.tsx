"use client";

import { useMemo, useState } from "react";
import { BookOpen, Search, Sparkles, X } from "lucide-react";
import FaqAccordion from "@/components/FaqAccordion";

export type FaqSearchItem = {
  id: string;
  question: string;
  answer: string;
};

export type FaqSearchGroup = {
  scope: string;
  label: string;
  description: string;
  items: FaqSearchItem[];
};

function sectionId(scope: string) {
  return `faq-${scope.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function normalize(value: string) {
  return value.toLocaleLowerCase("az-AZ").replace(/\s+/g, " ").trim();
}

export default function FaqSearchClient({ groups }: { groups: FaqSearchGroup[] }) {
  const [query, setQuery] = useState("");
  const normalizedQuery = normalize(query);
  const allCount = groups.reduce((sum, group) => sum + group.items.length, 0);

  const filteredGroups = useMemo(() => {
    if (!normalizedQuery) return groups;
    const tokens = normalizedQuery.split(" ").filter(Boolean);

    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          const haystack = normalize(`${group.label} ${item.question} ${item.answer}`);
          return tokens.every((token) => haystack.includes(token));
        }),
      }))
      .filter((group) => group.items.length > 0);
  }, [groups, normalizedQuery]);

  const resultCount = filteredGroups.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <>
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-3 shadow-[0_24px_90px_-60px_rgba(124,58,237,0.9)] sm:p-4">
          <label htmlFor="faq-search" className="sr-only">
            FAQ axtar
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
            <input
              id="faq-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="FAQ-da axtar: ödəniş, balans, PS Plus, Netflix..."
              className="h-14 w-full rounded-xl border border-white/10 bg-zinc-950/70 py-4 pl-12 pr-12 text-sm font-semibold text-white outline-none transition placeholder:text-zinc-500 focus:border-violet-300/50 focus:bg-zinc-950 focus:ring-4 focus:ring-violet-400/10"
            />
            {query.trim() ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Axtarışı təmizlə"
                className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-zinc-300 transition hover:bg-white/[0.1] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold text-zinc-400">
            <span className="rounded-full bg-white/[0.06] px-3 py-1">
              {normalizedQuery ? `${resultCount} nəticə` : `${allCount} sual`}
            </span>
            <span className="rounded-full bg-violet-400/10 px-3 py-1 text-violet-200">
              {filteredGroups.length} bölmə
            </span>
          </div>
        </div>
      </section>

      {filteredGroups.length > 0 ? (
        <section className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
          <div className="flex flex-wrap gap-2">
            {filteredGroups.map((group) => (
              <a
                key={group.scope}
                href={`#${sectionId(group.scope)}`}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-3 py-2 text-xs font-bold text-zinc-300 transition hover:border-violet-300/35 hover:bg-violet-400/10 hover:text-white"
              >
                <Sparkles className="h-3.5 w-3.5 text-violet-300" />
                {group.label}
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-zinc-400">
                  {group.items.length}
                </span>
              </a>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-7xl space-y-5 px-4 pb-16 sm:px-6 lg:px-8">
        {filteredGroups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.035] px-5 py-14 text-center">
            <Search className="mx-auto h-10 w-10 text-zinc-600" />
            <h2 className="mt-4 text-2xl font-black text-white">Uyğun sual tapılmadı</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-400">
              Başqa açar sözlə axtar və ya sualını AI bota yaz.
            </p>
            <button
              type="button"
              onClick={() => setQuery("")}
              className="mt-5 rounded-xl bg-white px-4 py-3 text-sm font-black text-zinc-950 transition hover:bg-zinc-200"
            >
              Axtarışı sıfırla
            </button>
          </div>
        ) : (
          filteredGroups.map((group) => (
            <div
              key={group.scope}
              id={sectionId(group.scope)}
              className="scroll-mt-28 rounded-2xl border border-white/10 bg-white/[0.035] p-5 sm:p-6 lg:grid lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-8"
            >
              <div className="mb-5 lg:mb-0">
                <span className="inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-violet-200">
                  <BookOpen className="h-3.5 w-3.5" />
                  {group.items.length} sual
                </span>
                <h2 className="mt-4 text-2xl font-black text-white">{group.label}</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  {group.description} səhifəsi ilə bağlı cavablar.
                </p>
              </div>
              <FaqAccordion items={group.items} />
            </div>
          ))
        )}
      </section>
    </>
  );
}
