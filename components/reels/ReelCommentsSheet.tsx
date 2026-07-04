"use client";

import { useEffect, useRef, useState } from "react";
import { X, Send, Loader2 } from "lucide-react";
import { useSession } from "@/components/SessionProvider";

type Comment = {
  id: string;
  body: string;
  authorName: string;
  badge: { displayName: string; icon: string | null; color: string | null } | null;
  createdAt: string;
};

/**
 * Reels şərh panosu — yalnız açılanda mount olunur (scroll hot path-dan kənar).
 * Şərh dərhal görünür (optimistik + server cavabı), moderasiya öncədən deyil.
 */
export default function ReelCommentsSheet({
  reelId,
  onClose,
  onCountChange,
}: {
  reelId: string;
  onClose: () => void;
  onCountChange?: (delta: number) => void;
}) {
  const { user } = useSession();
  const [items, setItems] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/reels/${reelId}/comments`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d: { items?: Comment[] }) => {
        if (!cancelled) {
          setItems(d.items ?? []);
          setLoading(false);
        }
      })
      .catch(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [reelId]);

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/reels/${reelId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = await res.json();
      if (res.ok && data.item) {
        setItems((prev) => [data.item, ...prev]);
        setText("");
        onCountChange?.(1);
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative flex max-h-[70%] flex-col rounded-t-2xl bg-zinc-900 text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <span className="text-sm font-bold">Şərhlər</span>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-white/50" />
            </div>
          ) : items.length === 0 ? (
            <p className="py-8 text-center text-sm text-white/50">İlk şərhi sən yaz 👋</p>
          ) : (
            items.map((c) => (
              <div key={c.id} className="flex gap-2">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-violet-600 text-xs font-bold">
                  {c.authorName.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    {c.authorName}
                    {c.badge && (
                      <span className="text-[10px] text-white/50">{c.badge.displayName}</span>
                    )}
                  </div>
                  <p className="text-sm text-white/90">{c.body}</p>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-white/10 p-3">
          {user ? (
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Şərh yaz..."
                maxLength={1000}
                className="flex-1 rounded-full bg-white/10 px-4 py-2 text-sm outline-none placeholder:text-white/40 focus:bg-white/15"
              />
              <button
                onClick={send}
                disabled={sending || !text.trim()}
                className="grid h-9 w-9 place-items-center rounded-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          ) : (
            <a
              href="/login?next=/reels"
              className="block rounded-full bg-violet-600 py-2 text-center text-sm font-semibold hover:bg-violet-500"
            >
              Şərh yazmaq üçün daxil ol
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
