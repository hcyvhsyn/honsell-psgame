"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useCart } from "@/lib/cart";

type ProductCard = {
  id: string;
  productId: string;
  title: string;
  imageUrl: string | null;
  finalAzn: number;
  originalAzn: number | null;
  discountPct: number | null;
  productType: string;
  store: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  products?: ProductCard[];
};

const GREETING =
  "Salam! 👋 Mən Honsell köməkçisiyəm. Saytdakı oyunlar, qiymətlər və endirimlər barədə istənilən sualını ver.";

export default function AskAiFloat() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  // null = hələ yoxlanılmayıb, true/false = giriş statusu.
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: GREETING },
  ]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Panel ilk açılanda giriş statusunu yoxla.
  useEffect(() => {
    if (!open || authed !== null) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/ai/chat", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!cancelled) setAuthed(Boolean(data.authed));
      } catch {
        if (!cancelled) setAuthed(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, authed]);

  // Dövri tooltip — istifadəçini köməkçidən xəbərdar edir (panel bağlı olanda).
  useEffect(() => {
    if (open) {
      setShowTooltip(false);
      return;
    }
    let cancelled = false;
    const cycle = () => {
      if (cancelled) return;
      setShowTooltip(true);
      setTimeout(() => {
        if (!cancelled) setShowTooltip(false);
      }, 3500);
    };
    const initial = setTimeout(cycle, 4000);
    const interval = setInterval(cycle, 14000);
    return () => {
      cancelled = true;
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [open]);

  // Yeni mesaj gələndə aşağı sürüşdür.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Panel açıq olanda theme toggle düyməsini gizlə (sağ kənarda üst-üstə düşür).
  useEffect(() => {
    const el = document.documentElement;
    if (open) el.setAttribute("data-ai-chat-open", "1");
    else el.removeAttribute("data-ai-chat-open");
    return () => el.removeAttribute("data-ai-chat-open");
  }, [open]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const history: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(history);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // İlk salamlamanı serverə göndərmirik; yalnız söhbəti (rol + mətn).
        body: JSON.stringify({
          messages: history
            .filter((_, i) => i > 0)
            .map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      // Sessiya bitibsə / daxil olmayıbsa — giriş qapısını göstər.
      if (res.status === 401) {
        setAuthed(false);
        setMessages((prev) => prev.slice(0, -1)); // göndərilən sualı geri götür
        setInput(text);
        return;
      }

      if (!res.ok) throw new Error("request failed");
      const data = (await res.json()) as { reply?: string; products?: ProductCard[] };

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply?.trim() || "Üzr istəyirəm, cavab ala bilmədim.",
          products: Array.isArray(data.products) ? data.products : [],
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Texniki problem yarandı. Bir az sonra yenidən cəhd et.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  if (
    pathname?.startsWith("/admin") ||
    pathname === "/login" ||
    pathname === "/register"
  ) {
    return null;
  }

  return (
    <div className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-[calc(1.25rem+env(safe-area-inset-right))] z-[130] flex flex-col items-end gap-3 sm:bottom-[calc(1.5rem+env(safe-area-inset-bottom))] sm:right-[calc(1.5rem+env(safe-area-inset-right))]">
      {/* Söhbət paneli */}
      {open && (
        <div className="flex h-[32rem] max-h-[75vh] w-[min(24rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[var(--background)] shadow-2xl shadow-black/40">
          {/* Başlıq */}
          <div className="flex items-center gap-3 border-b border-white/10 bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3 text-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/mascote.png"
              alt="Honsell maskotu"
              className="h-9 w-9 shrink-0 rounded-full bg-white/20 object-cover object-top"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">Honsell AI köməkçi</p>
              <p className="truncate text-xs text-white/70">Saytdakı məhsullar üzrə soruş</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Bağla"
              className="rounded-full p-1 text-white/80 transition-colors hover:bg-white/15 hover:text-white"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          {authed === false ? (
            <LoginGate pathname={pathname} />
          ) : authed === null ? (
            <div className="flex flex-1 items-center justify-center text-zinc-400">
              <TypingDots />
            </div>
          ) : (
          <>
          {/* Mesajlar */}
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-3 py-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "assistant" && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src="/mascote.png"
                    alt=""
                    className="mt-0.5 h-7 w-7 shrink-0 rounded-full bg-violet-500/20 object-cover object-top ring-1 ring-violet-400/30"
                  />
                )}
                <div className={`flex max-w-[85%] flex-col gap-2 ${m.role === "user" ? "items-end" : "items-start"}`}>
                  {m.content && (
                    <div
                      className={`break-words rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${
                        m.role === "user"
                          ? "rounded-br-sm bg-violet-600 text-white"
                          : "rounded-bl-sm border border-white/10 bg-white/[0.06] text-[var(--foreground)]"
                      }`}
                    >
                      {m.role === "user" ? (
                        <span className="whitespace-pre-wrap">{m.content}</span>
                      ) : (
                        <RichText text={m.content} />
                      )}
                    </div>
                  )}
                  {m.products && m.products.length > 0 && (
                    <div className="flex w-full flex-col gap-2">
                      {m.products.map((p) => (
                        <ProductRow key={p.id} product={p} onNavigate={() => setOpen(false)} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/mascote.png"
                  alt=""
                  className="mt-0.5 h-7 w-7 shrink-0 rounded-full bg-violet-500/20 object-cover object-top ring-1 ring-violet-400/30"
                />
                <div className="rounded-2xl rounded-bl-sm border border-white/10 bg-white/[0.06] px-3.5 py-2.5 text-sm text-[var(--foreground)]">
                  <TypingDots />
                </div>
              </div>
            )}
          </div>

          {/* Giriş */}
          <div className="border-t border-white/10 p-2">
            <div className="flex items-end gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Sualını yaz..."
                disabled={loading}
                className="flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-[var(--foreground)] outline-none placeholder:text-zinc-500 focus:border-violet-500/60"
              />
              <button
                onClick={send}
                disabled={loading || !input.trim()}
                aria-label="Göndər"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white transition-transform hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                  <path d="M3.4 20.4l17.45-7.48a1 1 0 000-1.84L3.4 3.6a.993.993 0 00-1.39.91L2 9.12c0 .5.37.93.87.99L17 12 2.87 13.88c-.5.07-.87.5-.87 1l.01 4.61c0 .71.73 1.2 1.39.91z" />
                </svg>
              </button>
            </div>
          </div>
          </>
          )}
        </div>
      )}

      {/* Açıcı düymə + tooltip */}
      <div className="flex items-end gap-2 self-end">
        {!open && (
          <div
            className={`pointer-events-none mb-3 origin-bottom-right rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-zinc-900 shadow-lg transition-all duration-300 ${
              showTooltip ? "translate-y-0 scale-100 opacity-100" : "translate-y-1 scale-95 opacity-0"
            }`}
          >
            <span className="relative">
              AI-dan soruş 🤖
              <span className="absolute -bottom-[10px] right-3 h-0 w-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-white" />
            </span>
          </div>
        )}

        <button
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Köməkçini bağla" : "AI köməkçi"}
          className="group relative inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-900/40 transition-transform duration-200 hover:scale-105 active:scale-95"
        >
          {!open && <span className="absolute inset-0 animate-ping rounded-full bg-violet-600 opacity-30" />}
          {!open && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/mascote.png"
              alt="Honsell maskotu"
              className="absolute inset-0 h-full w-full rounded-full object-cover object-top"
            />
          )}
          <span className="absolute inset-0 rounded-full ring-2 ring-white/20" />
          {open && (
            <svg viewBox="0 0 24 24" className="relative h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

function ProductRow({
  product,
  onNavigate,
}: {
  product: ProductCard;
  onNavigate: () => void;
}) {
  const { add, has, hydrated } = useCart();
  const inCart = hydrated && has(product.id);

  return (
    <div className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-2">
      <Link
        href={`/oyunlar/${product.productId}`}
        onClick={onNavigate}
        className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-black/20"
      >
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.imageUrl} alt={product.title} className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-lg">🎮</span>
        )}
      </Link>

      <div className="min-w-0 flex-1">
        <Link
          href={`/oyunlar/${product.productId}`}
          onClick={onNavigate}
          className="line-clamp-2 text-xs font-semibold text-[var(--foreground)] hover:underline"
        >
          {product.title}
        </Link>
        <div className="mt-0.5 flex items-center gap-1.5">
          <span className="text-sm font-bold text-violet-400">
            {product.finalAzn.toFixed(2)}₼
          </span>
          {product.discountPct && product.originalAzn ? (
            <>
              <span className="text-[11px] text-zinc-500 line-through">
                {product.originalAzn.toFixed(2)}₼
              </span>
              <span className="rounded bg-emerald-500/20 px-1 text-[10px] font-semibold text-emerald-400">
                -{product.discountPct}%
              </span>
            </>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        onClick={() =>
          !inCart &&
          add({
            id: product.id,
            title: product.title,
            imageUrl: product.imageUrl,
            finalAzn: product.finalAzn,
            productType: product.productType,
            store: product.store,
          })
        }
        disabled={inCart}
        aria-label={inCart ? "Səbətdədir" : "Səbətə əlavə et"}
        title={inCart ? "Səbətdədir" : "Səbətə əlavə et"}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white transition-transform hover:scale-105 active:scale-95 disabled:bg-emerald-600 disabled:opacity-90"
      >
        {inCart ? (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="9" cy="21" r="1" fill="currentColor" />
            <circle cx="20" cy="21" r="1" fill="currentColor" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M1 1h4l2.7 13.4a2 2 0 002 1.6h9.7a2 2 0 002-1.6L23 6H6" />
          </svg>
        )}
      </button>
    </div>
  );
}

/**
 * Köməkçi cavabını təhlükəsiz "zəngin mətn" kimi göstərir — yalnız React node-ları
 * qurulur (dangerouslySetInnerHTML YOXDUR), ona görə model/başlıq HTML inject edə
 * bilməz. Dəstəklənir: **qalın**, bullet (-, *, •) və nömrəli (1.) siyahılar,
 * paraqraflar.
 */
function RichText({ text }: { text: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let key = 0;

  const flushList = () => {
    if (!list) return;
    const items = list.items;
    blocks.push(
      list.ordered ? (
        <ol key={key++} className="my-1 ml-4 list-decimal space-y-0.5 marker:text-violet-400">
          {items.map((it, i) => (
            <li key={i}>{renderInline(it)}</li>
          ))}
        </ol>
      ) : (
        <ul key={key++} className="my-1 ml-1 space-y-0.5">
          {items.map((it, i) => (
            <li key={i} className="flex gap-1.5">
              <span className="mt-[2px] text-violet-400">•</span>
              <span>{renderInline(it)}</span>
            </li>
          ))}
        </ul>
      )
    );
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushList();
      continue;
    }
    const ordered = line.match(/^(\d+)[.)]\s+(.*)$/);
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    if (ordered) {
      if (!list || !list.ordered) {
        flushList();
        list = { ordered: true, items: [] };
      }
      list.items.push(ordered[2]);
    } else if (bullet) {
      if (!list || list.ordered) {
        flushList();
        list = { ordered: false, items: [] };
      }
      list.items.push(bullet[1]);
    } else {
      flushList();
      blocks.push(
        <p key={key++} className="my-0.5">
          {renderInline(line)}
        </p>
      );
    }
  }
  flushList();

  return <div className="space-y-0.5">{blocks}</div>;
}

/** `**qalın**` hissələrini <strong>-a çevirir (qalanı düz mətn — escape olunur). */
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-violet-300">
          {p.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{p}</span>;
  });
}

/** Daxil olmamış istifadəçi üçün giriş qapısı — köməkçi yalnız hesabla işləyir. */
function LoginGate({ pathname }: { pathname: string | null }) {
  const next = encodeURIComponent(pathname || "/");
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-8 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/mascote.png"
        alt="Honsell maskotu"
        className="h-16 w-16 rounded-full bg-violet-500/20 object-cover object-top ring-2 ring-violet-400/30"
      />
      <div>
        <p className="text-sm font-semibold text-[var(--foreground)]">
          Köməkçidən istifadə üçün daxil ol
        </p>
        <p className="mt-1 text-xs text-zinc-400">
          Sual vermək üçün hesabına daxil ol. Hesabın yoxdursa, bir dəqiqəyə
          qeydiyyatdan keç.
        </p>
      </div>
      <div className="flex w-full flex-col gap-2">
        <Link
          href={`/login?next=${next}`}
          className="w-full rounded-full bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500"
        >
          Daxil ol
        </Link>
        <Link
          href={`/register?next=${next}`}
          className="w-full rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] transition hover:bg-white/10"
        >
          Qeydiyyatdan keç
        </Link>
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex gap-1 py-1">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
    </span>
  );
}
