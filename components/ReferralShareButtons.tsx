"use client";

import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import {
  buildReferralRegisterUrl,
  buildTelegramShareLink,
  buildWhatsAppShareLink,
} from "@/lib/referralPromotion";

export default function ReferralShareButtons({
  code,
  variant = "default",
}: {
  code: string;
  /** "default" → tam pad, "compact" → daha kiçik pill düymələr. */
  variant?: "default" | "compact";
}) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  function copy(value: string, kind: "code" | "link") {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  const wa = buildWhatsAppShareLink(code);
  const tg = buildTelegramShareLink(code);
  const url = buildReferralRegisterUrl(code);

  const padding = variant === "compact" ? "px-3 py-1.5 text-xs" : "px-4 py-2.5 text-sm";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => copy(code, "code")}
        className={`inline-flex items-center gap-1.5 rounded-full bg-white/10 ${padding} font-semibold text-white transition hover:bg-white/15`}
      >
        {copied === "code" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied === "code" ? "Kopyalandı" : "Kodu kopyala"}
      </button>
      <button
        type="button"
        onClick={() => copy(url, "link")}
        className={`inline-flex items-center gap-1.5 rounded-full bg-white/5 ${padding} font-medium text-zinc-200 transition hover:bg-white/10`}
      >
        {copied === "link" ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
        {copied === "link" ? "Linki kopyalandı" : "Linki kopyala"}
      </button>
      <a
        href={wa}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-1.5 rounded-full bg-[#25D366]/90 ${padding} font-semibold text-white transition hover:bg-[#25D366]`}
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884" />
        </svg>
        WhatsApp
      </a>
      <a
        href={tg}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-1.5 rounded-full bg-[#229ED9] ${padding} font-semibold text-white transition hover:bg-[#1B8AC1]`}
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.223-.548.223l.188-2.85 5.18-4.686c.223-.195-.054-.285-.346-.086l-6.4 4.024-2.76-.86c-.6-.185-.615-.6.125-.89l10.736-4.135c.498-.184.935.114.825.86z" />
        </svg>
        Telegram
      </a>
    </div>
  );
}
