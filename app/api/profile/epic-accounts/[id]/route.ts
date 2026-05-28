import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await prisma.epicAccount.findUnique({ where: { id: params.id } });
  if (!account || account.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const updates: {
    label?: string;
    epicEmail?: string;
    epicPassword?: string;
    displayName?: string;
    isDefault?: boolean;
  } = {};
  if (typeof body.label === "string") {
    updates.label = body.label.trim().slice(0, 60) || account.label;
  }
  if (typeof body.epicEmail === "string" && body.epicEmail.trim()) {
    updates.epicEmail = body.epicEmail.trim();
  }
  if (typeof body.epicPassword === "string" && body.epicPassword.length > 0) {
    updates.epicPassword = body.epicPassword;
  }
  if (typeof body.displayName === "string" && body.displayName.trim()) {
    updates.displayName = body.displayName.trim().slice(0, 60);
  }
  if (body.isDefault === true) updates.isDefault = true;

  if (updates.isDefault) {
    await prisma.$transaction([
      prisma.epicAccount.updateMany({
        where: { userId: user.id, isDefault: true },
        data: { isDefault: false },
      }),
      prisma.epicAccount.update({ where: { id: account.id }, data: updates }),
    ]);
  } else if (Object.keys(updates).length > 0) {
    await prisma.epicAccount.update({ where: { id: account.id }, data: updates });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await prisma.epicAccount.findUnique({ where: { id: params.id } });
  if (!account || account.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.epicAccount.delete({ where: { id: account.id } });
    if (account.isDefault) {
      const next = await tx.epicAccount.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "asc" },
      });
      if (next) {
        await tx.epicAccount.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    }
  });

  return NextResponse.json({ ok: true });
}
