import { getR2Object, hasR2Credentials } from "@/lib/r2";
import { STUDENT_CARD_PREFIX } from "@/lib/imageUploadServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * R2 public media proxy — `https://honsell.site/cdn/<key>`.
 *
 * Niyə: `cdn.honsell.store` domeni bitib, `honsell.site` isə Cloudflare-də deyil
 * (Namecheap DNS) → R2 bucket-ə custom domain bağlamaq mümkün deyil. Bu route
 * obyektləri S3 API ilə oxuyub ötürür; şəkillər açarı unikal olduğu üçün
 * (`<prefix>/<timestamp>-<rand>.<ext>`) `immutable` keş təhlükəsizdir — brauzer
 * hər faylı bir dəfə çəkir.
 *
 * ⚠️ PRIVATE prefikslər burada bloklanır — tələbə kartları eyni bucket-dədir və
 * yalnız qısa-ömürlü signed URL ilə açılmalıdır (lib/imageUploadServer.ts).
 *
 * Yeni yükləmələr avtomatik bu yola yazılır (lib/mediaUrl.ts), köhnə DB
 * linkləri `20261015000000_media_host_proxy` miqrasiyası ilə düzəlir.
 */
const PRIVATE_PREFIXES = [`${STUDENT_CARD_PREFIX}/`];

const PASS_HEADERS = ["content-type", "content-length", "content-range", "etag", "last-modified"] as const;

export async function GET(req: Request, { params }: { params: { key: string[] } }) {
  if (!hasR2Credentials()) {
    return new Response("Media storage not configured", { status: 503 });
  }

  const segments = (params.key ?? []).map((s) => decodeURIComponent(s));
  if (
    segments.length === 0 ||
    segments.some((s) => !s || s === "." || s === ".." || s.includes("\\") || s.includes("\0"))
  ) {
    return new Response("Not found", { status: 404 });
  }
  const key = segments.join("/");
  if (PRIVATE_PREFIXES.some((p) => key.startsWith(p))) {
    return new Response("Not found", { status: 404 });
  }

  const range = req.headers.get("range");
  const ifNoneMatch = req.headers.get("if-none-match");

  try {
    const obj = await getR2Object(key, { range, ifNoneMatch });
    const headers = new Headers({
      "cache-control": "public, max-age=31536000, immutable",
      "accept-ranges": "bytes",
      "x-content-type-options": "nosniff",
    });
    const meta: Record<(typeof PASS_HEADERS)[number], string | undefined> = {
      "content-type": obj.ContentType,
      "content-length": obj.ContentLength != null ? String(obj.ContentLength) : undefined,
      "content-range": obj.ContentRange,
      etag: obj.ETag,
      "last-modified": obj.LastModified?.toUTCString(),
    };
    for (const h of PASS_HEADERS) {
      const v = meta[h];
      if (v) headers.set(h, v);
    }
    const body = obj.Body?.transformToWebStream();
    return new Response(body ?? null, { status: obj.ContentRange ? 206 : 200, headers });
  } catch (err) {
    const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
    const status = e.$metadata?.httpStatusCode;
    if (status === 304 || e.name === "NotModified") {
      return new Response(null, {
        status: 304,
        headers: { "cache-control": "public, max-age=31536000, immutable" },
      });
    }
    if (status === 404 || e.name === "NoSuchKey") {
      return new Response("Not found", { status: 404, headers: { "cache-control": "public, max-age=60" } });
    }
    if (status === 416 || e.name === "InvalidRange") {
      return new Response("Range not satisfiable", { status: 416 });
    }
    console.error("[cdn] R2 read failed", key, err);
    return new Response("Upstream error", { status: 502 });
  }
}

export async function HEAD(req: Request, ctx: { params: { key: string[] } }) {
  const res = await GET(req, ctx);
  await res.body?.cancel().catch(() => {});
  return new Response(null, { status: res.status, headers: res.headers });
}
