"use client";

import { useState } from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useEffect } from "react";

type Faq = { id: string; question: string; answer: string };

export default function FaqAccordion() {
  const [open, setOpen] = useState<number | null>(null);
  const [faqs, setFaqs] = useState<Faq[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/faq", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { faqs?: Faq[] }) => {
        if (cancelled) return;
        setFaqs(Array.isArray(d.faqs) ? d.faqs : []);
      })
      .catch(() => {
        if (cancelled) return;
        setFaqs([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (faqs && faqs.length === 0) return null;
  
  return (
    <div className="flex flex-col">
      {(faqs ?? []).map((f, i) => (
        <div key={i} className="border-b border-white/10 last:border-0">
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="group flex w-full items-center justify-between py-6 text-left transition-colors"
          >
            <span className={`text-xl font-medium sm:text-2xl ${open === i ? "text-white" : "text-zinc-100 group-hover:text-white"}`}>
              {f.question}
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
                {f.answer}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
