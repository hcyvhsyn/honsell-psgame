import { NextResponse } from "next/server";
import { requirePartnerKey } from "@/lib/partnerAuth";
import { offerReviewLink } from "@/lib/whatsappReviewInvites";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * CRM → ödəniş təsdiqi mesajının sonuna əlavə olunacaq rəy linki.
 *
 *   POST /api/partner/review-links
 *   Header: X-API-Key: <PARTNER_API_KEY>
 *   Body:   { phone, productTitle, platform?, externalRef?, items? }
 *
 *   → { url: "https://honsell.site/rey/<token>", skipped: null, ... }
 *   → { url: null, skipped: "ALREADY_REVIEWED" | "RECENTLY_INVITED" | "PHONE_INVALID" }
 *
 * `/api/partner/review-invites`-dən fərqi: mağaza WhatsApp GÖNDƏRMİR (müştəri iki
 * ayrı mesaj almasın) və "rəy yazana qədər, 30 gündə bir" limiti tətbiq olunur.
 * `skipped` xəta deyil — CRM sadəcə linksiz mesaj göndərir.
 */
export async function POST(req: Request) {
  const denied = requirePartnerKey(req);
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const result = await offerReviewLink({
    phone: body?.phone,
    productTitle: body?.productTitle,
    platform: body?.platform,
    externalRef: body?.externalRef,
    items: body?.items,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}
