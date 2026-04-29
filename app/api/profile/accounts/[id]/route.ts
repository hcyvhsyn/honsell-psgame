import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

/** PATCH — partial update. Currently supports `isDefault: true` and `label`. */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await prisma.psnAccount.findUnique({ where: { id: params.id } });
  if (!account || account.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const updates: {
    label?: string;
    psnEmail?: string;
    psnPassword?: string;
    psModel?: string;
    isDefault?: boolean;
  } = {};
  if (typeof body.label === "string") {
    updates.label = body.label.trim().slice(0, 40) || account.label;
  }
  if (typeof body.psnEmail === "string" && body.psnEmail.trim()) {
    updates.psnEmail = body.psnEmail.trim();
  }
  if (typeof body.psnPassword === "string" && body.psnPassword.length > 0) {
    updates.psnPassword = body.psnPassword;
  }
  if (typeof body.psModel === "string") {
    const m = body.psModel.trim().toUpperCase();
    if (m !== "PS4" && m !== "PS5") {
      return NextResponse.json(
        { error: "PlayStation modeli yalnız PS4 və ya PS5 ola bilər" },
        { status: 400 }
      );
    }
    updates.psModel = m;
  }
  if (body.isDefault === true) updates.isDefault = true;

  if (updates.isDefault) {
    // Atomically flip default → only this row stays default.
    await prisma.$transaction([
      prisma.psnAccount.updateMany({
        where: { userId: user.id, isDefault: true },
        data: { isDefault: false },
      }),
      prisma.psnAccount.update({
        where: { id: account.id },
        data: updates,
      }),
    ]);
  } else if (Object.keys(updates).length > 0) {
    await prisma.psnAccount.update({ where: { id: account.id }, data: updates });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await prisma.psnAccount.findUnique({ where: { id: params.id } });
  if (!account || account.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.psnAccount.delete({ where: { id: account.id } });

    // If we deleted the default and other accounts remain, promote the
    // oldest remaining one to default.
    if (account.isDefault) {
      const next = await tx.psnAccount.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "asc" },
      });
      if (next) {
        await tx.psnAccount.update({
          where: { id: next.id },
          data: { isDefault: true },
        });
      }
    }
  });

  return NextResponse.json({ ok: true });
}
