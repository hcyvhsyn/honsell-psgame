import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { isR2Configured, putR2Object } from "@/lib/r2";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BYTES = 200 * 1024 * 1024;

/**
 * Uzaq video URL-ini R2-yə (cdn.honsell.store) çəkir ki, native sürət (range,
 * bizim keş) qalsın. R2 qurulmayıbsa (dev) URL olduğu kimi qaytarılır.
 */
export async function POST(req: Request) {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const url = String(body?.url ?? "").trim();
  if (!/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: "Düzgün URL daxil edin" }, { status: 400 });
  }

  // R2 yoxdursa — linki olduğu kimi saxla (dev fallback).
  if (!isR2Configured()) {
    return NextResponse.json({ url });
  }

  try {
    const res = await fetch(url);
    if (!res.ok) {
      return NextResponse.json({ error: `Mənbə açılmadı (${res.status})` }, { status: 400 });
    }
    const ct = (res.headers.get("content-type") || "video/mp4").split(";")[0].trim();
    if (!ct.startsWith("video/")) {
      return NextResponse.json({ error: "Link video deyil" }, { status: 400 });
    }
    const len = Number(res.headers.get("content-length") || 0);
    if (len && len > MAX_BYTES) {
      return NextResponse.json({ error: "Video çox böyükdür (maks 200MB)" }, { status: 400 });
    }

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: "Video çox böyükdür (maks 200MB)" }, { status: 400 });
    }

    const ext = ct.includes("webm") ? "webm" : "mp4";
    const rand = Math.random().toString(36).slice(2, 8);
    const key = `reels/${Date.now()}-${rand}.${ext}`;
    const publicUrl = await putR2Object(key, buf, ct);
    return NextResponse.json({ url: publicUrl });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "İdxal alınmadı";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
