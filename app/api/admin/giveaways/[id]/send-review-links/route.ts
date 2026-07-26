import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  sendWinnerReviewLinks,
  sendWinnerReviewLinkOne,
  listReviewLinkRecipients,
} from "@/lib/giveaways";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** GET → rəy linki göndəriləcək qaliblərin siyahısı. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  await requireAdmin();
  const data = await listReviewLinkRecipients(params.id);
  return NextResponse.json(data);
}

/**
 * POST → rəy linki göndər.
 *  • body.entryId varsa → yalnız o qalibə (client 10s aralıqla).
 *  • yoxdursa → köhnə toplu göndəriş (backward-compat).
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  await requireAdmin();
  const body = await req.json().catch(() => ({}));

  if (typeof body.entryId === "string" && body.entryId) {
    const result = await sendWinnerReviewLinkOne(params.id, body.entryId);
    return NextResponse.json(result);
  }

  const result = await sendWinnerReviewLinks(params.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}
