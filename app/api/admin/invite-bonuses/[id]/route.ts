import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { approveHeldInviteBonus, rejectHeldInviteBonus } from "@/lib/inviteBonus";

export const runtime = "nodejs";

/**
 * Gözləmədə (HELD) saxlanmış dəvət bonusunu admin təsdiq edir və ya rədd edir.
 * Body: { action: "approve" | "reject" }.
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "");

  if (action === "approve") {
    const result = await approveHeldInviteBonus(params.id, admin.id);
    if (!result) {
      return NextResponse.json(
        { error: "Bonus tapılmadı və ya artıq emal olunub." },
        { status: 409 }
      );
    }
    return NextResponse.json({ ok: true, status: "PAID", amountAzn: result.amountCents / 100 });
  }

  if (action === "reject") {
    const ok = await rejectHeldInviteBonus(params.id, admin.id);
    if (!ok) {
      return NextResponse.json(
        { error: "Bonus tapılmadı və ya artıq emal olunub." },
        { status: 409 }
      );
    }
    return NextResponse.json({ ok: true, status: "REJECTED" });
  }

  return NextResponse.json({ error: "Naməlum əməliyyat." }, { status: 400 });
}
