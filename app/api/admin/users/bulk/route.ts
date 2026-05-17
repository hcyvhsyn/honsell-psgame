import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";

const ACTIONS = ["disable", "enable", "verify", "delete"] as const;
type Action = (typeof ACTIONS)[number];

export async function POST(req: Request) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const action = body.action as Action;
  const userIds: string[] = Array.isArray(body.userIds) ? body.userIds.filter((x: unknown) => typeof x === "string") : [];

  if (!ACTIONS.includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
  if (userIds.length === 0) {
    return NextResponse.json({ error: "Heç bir istifadəçi seçilməyib" }, { status: 400 });
  }
  if (userIds.length > 500) {
    return NextResponse.json({ error: "Maksimum 500 istifadəçi seçə bilərsiniz" }, { status: 400 });
  }

  if (userIds.includes(admin.id) && (action === "disable" || action === "delete")) {
    return NextResponse.json({ error: "Öz hesabınızı silə və ya bloklaya bilməzsiniz" }, { status: 400 });
  }

  const targets = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, role: true },
  });

  if (action === "disable" || action === "delete") {
    const hasAdmin = targets.some((u) => u.role === "ADMIN");
    if (hasAdmin) {
      return NextResponse.json(
        { error: "Admin istifadəçilərini silmək və ya bloklamaq olmaz" },
        { status: 400 }
      );
    }
  }

  if (action === "disable") {
    await prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: { disabled: true, disabledAt: new Date() },
    });
  } else if (action === "enable") {
    await prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: { disabled: false, disabledAt: null, disabledReason: null },
    });
  } else if (action === "verify") {
    await prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: { emailVerified: true },
    });
  } else if (action === "delete") {
    await prisma.$transaction(async (ptx) => {
      await ptx.user.updateMany({
        where: { referredById: { in: userIds } },
        data: { referredById: null },
      });
      await ptx.transaction.deleteMany({
        where: { OR: [{ userId: { in: userIds } }, { beneficiaryId: { in: userIds } }] },
      });
      await ptx.psnAccount.deleteMany({ where: { userId: { in: userIds } } });
      await ptx.user.deleteMany({ where: { id: { in: userIds } } });
    });
  }

  return NextResponse.json({ ok: true, affected: targets.length });
}
