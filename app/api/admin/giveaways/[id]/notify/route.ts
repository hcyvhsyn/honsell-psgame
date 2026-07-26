import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  notifyGiveawayWinners,
  notifyGiveawayWinnerOne,
  listWinnerNotifyRecipients,
} from "@/lib/giveaways";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** GET → göndəriləcək qaliblərin siyahısı (client 10s aralıqla göndərir). */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  await requireAdmin();
  const data = await listWinnerNotifyRecipients(params.id);
  return NextResponse.json(data);
}

/**
 * POST → təbrik bildirişi göndər.
 *  • body.entryId varsa → yalnız o qalibə (client 10s aralıqla bir-bir çağırır).
 *  • yoxdursa → köhnə toplu göndəriş (backward-compat).
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  await requireAdmin();
  const body = await req.json().catch(() => ({}));

  if (typeof body.entryId === "string" && body.entryId) {
    const result = await notifyGiveawayWinnerOne(params.id, body.entryId);
    return NextResponse.json(result);
  }

  const result = await notifyGiveawayWinners(params.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}
