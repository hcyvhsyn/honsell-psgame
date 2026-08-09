import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

/**
 * Server-server (machine-to-machine) auth — CRM (crm.honsell.store) üçün.
 * Model [app/api/games/search/route.ts]-dən götürülüb: paylaşılan gizli açar,
 * sabit vaxtlı müqayisə, açar konfiqurasiya olunmayıbsa **fail-closed**.
 *
 * Uğurda `null` qaytarır (davam et), əks halda hazır error cavabı.
 *
 * ⚠️ Cloudflare/WAF: `/api/partner/*` brauzer yolu deyil. Bot Fight Mode bu yolu
 * bloklamamalıdır — `X-API-Key` başlığı olan sorğulara icazə qaydası lazımdır
 * (kod deyil, infra işi).
 */
export function requirePartnerKey(req: Request): NextResponse | null {
  const expected = process.env.PARTNER_API_KEY?.trim();
  if (!expected) {
    return NextResponse.json({ error: "Partner API is not configured" }, { status: 503 });
  }
  const provided = req.headers.get("x-api-key")?.trim() ?? "";
  if (!apiKeyMatches(provided, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/** Sabit vaxtlı açar müqayisəsi (timing-attack qorunması). */
function apiKeyMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
