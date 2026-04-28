"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export default function ReferralCodeCopy({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1.5 rounded-md border border-zinc-800 px-2.5 py-1 text-xs text-zinc-300 hover:border-indigo-500/60 hover:text-white"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5" /> Kopyalandı
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" /> Kopyala
        </>
      )}
    </button>
  );
}
