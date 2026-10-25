import { NextResponse } from "next/server";
import { getInstallmentOffer } from "@/lib/installments";

/**
 * Taksit təklifi: `{ enabled, minAzn, cards: [{ id, name, months }] }`.
 * `?amount=` verilsə həmin məbləğ üçün (səbət), verilməsə ümumi (məhsul səhifəsi).
 * Cavab user-dan asılı deyil — CDN/edge keşlənə bilər.
 */
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("amount");
  const amount = raw != null ? Number(raw) : NaN;
  const amountAzn = Number.isFinite(amount) && amount > 0 && amount < 100_000 ? amount : undefined;

  const offer = await getInstallmentOffer(amountAzn);
  return NextResponse.json(offer, {
    headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" },
  });
}
