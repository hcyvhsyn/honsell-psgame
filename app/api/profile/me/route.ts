import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

const GENDERS = new Set(["MALE", "FEMALE"]);

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));

  const updates: {
    name?: string | null;
    phone?: string | null;
    birthDate?: Date | null;
    gender?: string | null;
  } = {};

  if ("name" in body) {
    const v = String(body.name ?? "").trim().slice(0, 80);
    updates.name = v === "" ? null : v;
  }

  if ("phone" in body) {
    const v = String(body.phone ?? "").trim().slice(0, 30);
    updates.phone = v === "" ? null : v;
  }

  if ("birthDate" in body) {
    if (body.birthDate === null || body.birthDate === "") {
      updates.birthDate = null;
    } else {
      const d = new Date(String(body.birthDate));
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json(
          { error: "Doğum tarixi düzgün deyil" },
          { status: 400 }
        );
      }
      const today = new Date();
      if (d > today) {
        return NextResponse.json(
          { error: "Doğum tarixi gələcəkdə ola bilməz" },
          { status: 400 }
        );
      }
      updates.birthDate = d;
    }
  }

  if ("gender" in body) {
    if (body.gender === null || body.gender === "") {
      updates.gender = null;
    } else {
      const g = String(body.gender).toUpperCase();
      if (!GENDERS.has(g)) {
        return NextResponse.json({ error: "Cinsiyət düzgün deyil" }, { status: 400 });
      }
      updates.gender = g;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: updates,
    select: {
      id: true,
      name: true,
      phone: true,
      birthDate: true,
      gender: true,
    },
  });

  return NextResponse.json({ user: updated });
}
