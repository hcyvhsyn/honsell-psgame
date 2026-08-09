import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { searchReviewProducts } from "@/lib/whatsappReviewProductSearch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin panelindəki rəy dəvəti picker-i. Axtarış məntiqi
 * [lib/whatsappReviewProductSearch.ts] içindədir — CRM (partner) endpoint-i də
 * eyni funksiyanı çağırır ki, iki panel fərqli nəticə göstərməsin.
 */
export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const results = await searchReviewProducts(url.searchParams.get("q") ?? "");
  return NextResponse.json({ results });
}
