/**
 * Media (R2) public bazası + köhnə host-ların normallaşdırılması.
 * Client-safe SAF modul — prisma import ETMƏ.
 *
 * `cdn.honsell.store` domeni bitib, `cdn.honsell.site` heç vaxt qurulmayıb
 * (honsell.site Cloudflare-də deyil). Media öz proxy-mizdən verilir:
 * `https://honsell.site/cdn/<key>` (app/cdn/[...key]/route.ts).
 *
 * Env-də köhnə host qalsa belə (server `.env`-i əl ilə dəyişmək lazım
 * olmasın deyə) baza avtomatik proxy-yə düşür.
 */

export const MEDIA_PROXY_BASE = "https://honsell.site/cdn";

export const LEGACY_MEDIA_PREFIXES = ["https://cdn.honsell.store", "https://cdn.honsell.site"];

function isLegacy(url: string): boolean {
  return LEGACY_MEDIA_PREFIXES.some((p) => url === p || url.startsWith(`${p}/`));
}

/** Yeni yükləmələrin yazılacağı public baza (sonda `/` yoxdur). */
export function mediaPublicBase(): string {
  const env = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.trim() || "").replace(/\/+$/, "");
  if (!env || isLegacy(env)) return MEDIA_PROXY_BASE;
  return env;
}

/**
 * DB-dən gələn köhnə media linkini işlək ünvana çevirir. Miqrasiya
 * (`20261015000000_media_host_proxy`) bazanı onsuz da düzəldir — bu, keşdə
 * qalmış və ya sonradan köhnə linklə yazılmış sətirlər üçün sığortadır.
 */
export function normalizeMediaUrl<T extends string | null | undefined>(url: T): T {
  if (!url) return url;
  for (const p of LEGACY_MEDIA_PREFIXES) {
    if (url.startsWith(`${p}/`)) return `${mediaPublicBase()}${url.slice(p.length)}` as T;
  }
  return url;
}
