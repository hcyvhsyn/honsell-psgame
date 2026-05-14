"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Image as ImageIcon, Loader2, Upload, X } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

type Product = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  priceAznCents: number;
  isActive: boolean;
  sortOrder: number;
  denominationAzn: number;
};

export default function HonsellProductsAdmin({ products }: { products: Product[] }) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
      <header>
        <h2 className="text-sm font-semibold text-white">Nominal kartların görüntüsü</h2>
        <p className="mt-1 text-xs text-zinc-400">
          Hər nominal üçün şəkil, başlıq və təsvir redaktə olunur. Qiymət və nominal sabit qalır.
        </p>
      </header>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {products.map((p) => (
          <ProductCard key={p.id} initial={p} />
        ))}
      </div>
    </section>
  );
}

function ProductCard({ initial }: { initial: Product }) {
  const router = useRouter();
  const [imageUrl, setImageUrl] = useState(initial.imageUrl ?? "");
  const [title, setTitle] = useState(initial.title);
  const [isActive, setIsActive] = useState(initial.isActive);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<null | { kind: "ok" | "error"; text: string }>(null);

  const dirty =
    imageUrl !== (initial.imageUrl ?? "") ||
    title !== initial.title ||
    isActive !== initial.isActive;

  async function handleImageFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setStatus({ kind: "error", text: "Yalnız şəkil faylı yüklənə bilər." });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setStatus({ kind: "error", text: "Fayl çox böyükdür (max 5 MB)." });
      return;
    }
    setUploading(true);
    setStatus(null);
    try {
      const init = await fetch("/api/admin/services/image-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: file.type }),
      });
      const initData = await init.json();
      if (!init.ok) {
        setStatus({ kind: "error", text: initData?.error ?? "Upload hazırlanmadı." });
        return;
      }
      const supabase = getSupabaseBrowser();
      const { error: upErr } = await supabase.storage
        .from(initData.bucket)
        .uploadToSignedUrl(initData.path, initData.token, file);
      if (upErr) {
        setStatus({ kind: "error", text: `Upload alınmadı: ${upErr.message}` });
        return;
      }
      setImageUrl(initData.publicUrl);
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch("/api/admin/honsell-gift-cards/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: initial.id,
          title,
          imageUrl: imageUrl || null,
          isActive,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus({ kind: "error", text: data?.error ?? "Yeniləmə uğursuz oldu." });
        return;
      }
      setStatus({ kind: "ok", text: "Yadda saxlandı." });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-zinc-500">Nominal</span>
        <span className="text-lg font-bold text-white">{initial.denominationAzn} AZN</span>
      </div>

      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
        {imageUrl ? (
          <Image src={imageUrl} alt={title} fill sizes="(max-width: 640px) 100vw, 25vw" className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-zinc-700">
            <ImageIcon className="h-8 w-8" />
          </div>
        )}
        {imageUrl && (
          <button
            type="button"
            onClick={() => setImageUrl("")}
            className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
            aria-label="Şəkli sil"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <label className="block">
        <span className="block text-[10px] uppercase tracking-wider text-zinc-500">Başlıq</span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-sm text-white outline-none focus:border-violet-500/60"
        />
      </label>

      <label className="flex items-center gap-2 text-xs text-zinc-300">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-900 text-violet-500"
        />
        Aktiv
      </label>

      <label
        className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed px-2 py-1.5 text-xs transition ${
          uploading
            ? "border-violet-500/40 bg-violet-500/10 text-violet-200"
            : "border-zinc-700 text-zinc-300 hover:border-violet-400/40 hover:bg-zinc-900"
        }`}
      >
        {uploading ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Yüklənir…
          </>
        ) : (
          <>
            <Upload className="h-3.5 w-3.5" /> Şəkil yüklə
          </>
        )}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleImageFile(f);
            e.target.value = "";
          }}
        />
      </label>
      <p className="text-[10px] leading-snug text-zinc-500">
        Tövsiyə olunan ölçü: <b className="text-zinc-300">1200×900px</b> (4:3 aspekt). Max 5 MB · PNG / JPEG / WEBP.
      </p>

      <button
        type="button"
        onClick={save}
        disabled={!dirty || saving || uploading}
        className="inline-flex items-center justify-center gap-2 rounded-md bg-violet-600 px-2 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 hover:bg-violet-500"
      >
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        Yadda saxla
      </button>

      {status && (
        <p
          className={`text-[11px] ${
            status.kind === "ok" ? "text-emerald-300" : "text-rose-300"
          }`}
        >
          {status.text}
        </p>
      )}
    </div>
  );
}
