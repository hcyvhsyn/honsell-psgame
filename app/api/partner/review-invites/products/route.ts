import { NextResponse } from "next/server";
import { requirePartnerKey } from "@/lib/partnerAuth";
import { searchReviewProducts } from "@/lib/whatsappReviewProductSearch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * CRM-in rəy dəvəti modalındakı məhsul axtarışı.
 *
 *   GET /api/partner/review-invites/products?q=spotify
 *   Header: X-API-Key: <PARTNER_API_KEY>
 *
 * Admin panelindəki picker ilə EYNİ funksiyanı çağırır — iki panel fərqli
 * nəticə/qiymət göstərməməlidir.
 */
export async function GET(req: Request) {
  const denied = requirePartnerKey(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const results = await searchReviewProducts(url.searchParams.get("q") ?? "");
  return NextResponse.json({ results });
}
