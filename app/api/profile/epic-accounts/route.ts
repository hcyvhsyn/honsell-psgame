import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const accounts = await prisma.epicAccount.findMany({
    where: { userId: user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      label: true,
      firstName: true,
      lastName: true,
      birthDate: true,
      epicEmail: true,
      epicPassword: true,
      displayName: true,
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
  const epicEmail = String(body.epicEmail ?? "").trim();
  const epicPassword = String(body.epicPassword ?? "");
  const displayName = String(body.displayName ?? "").trim().slice(0, 60);
  const label = String(body.label ?? displayName).trim().slice(0, 60) || "Epic hesabı";
  const firstName = String(body.firstName ?? "").trim().slice(0, 60);
  const lastName = String(body.lastName ?? "").trim().slice(0, 60);
  const birthDate = String(body.birthDate ?? "").trim().slice(0, 20);

  if (!epicEmail || !epicPassword || !displayName) {
    return NextResponse.json(
      { error: "E-poçt, şifrə və görünən ad tələb olunur" },
      { status: 400 }
    );
  }

  const existing = await prisma.epicAccount.count({ where: { userId: user.id } });
  const account = await prisma.epicAccount.create({
    data: {
      userId: user.id,
      label,
      firstName,
      lastName,
      birthDate,
      epicEmail,
      epicPassword,
      displayName,
      isDefault: existing === 0,
    },
    select: { id: true, label: true, epicEmail: true, displayName: true, isDefault: true },
  });
  return NextResponse.json({ account });
}
