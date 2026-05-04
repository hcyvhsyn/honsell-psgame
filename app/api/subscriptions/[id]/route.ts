import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const autoRenew = typeof body.autoRenew === "boolean" ? body.autoRenew : null;
  if (autoRenew === null) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const sub = await prisma.subscription.findUnique({
    where: { id: params.id },
    select: { id: true, userId: true, status: true },
  });
  if (!sub || sub.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (sub.status !== "ACTIVE") {
    return NextResponse.json({ error: "Yalnız aktiv abunəlik üçün dəyişdirilə bilər." }, { status: 400 });
  }

  await prisma.subscription.update({
    where: { id: params.id },
    data: { autoRenew },
  });

  return NextResponse.json({ ok: true, autoRenew });
}
