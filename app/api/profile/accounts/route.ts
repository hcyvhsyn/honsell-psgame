import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const accounts = await prisma.psnAccount.findMany({
    where: { userId: user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      label: true,
      psnEmail: true,
      psnPassword: true,
      isDefault: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ accounts });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const label = String(body.label ?? "").trim().slice(0, 40);
  const psnEmail = String(body.psnEmail ?? "").trim();
  const psnPassword = String(body.psnPassword ?? "");

  if (!label || !psnEmail || !psnPassword) {
    return NextResponse.json(
      { error: "Ad, PSN e-poçtu və şifrə tələb olunur" },
      { status: 400 }
    );
  }

  // First account becomes default automatically.
  const existing = await prisma.psnAccount.count({ where: { userId: user.id } });
  const account = await prisma.psnAccount.create({
    data: {
      userId: user.id,
      label,
      psnEmail,
      psnPassword,
      isDefault: existing === 0,
    },
    select: { id: true, label: true, psnEmail: true, isDefault: true },
  });
  return NextResponse.json({ account });
}
