import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "application/pdf"]);

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Form məlumatı oxunmadı" }, { status: 400 });
  }
  const amountAzn = Number(form.get("amountAzn"));
  const f = form.get("receipt");
  if (!(f instanceof File)) {
    return NextResponse.json({ error: "Qəbz şəkli tələb olunur" }, { status: 400 });
  }
  const file = f;

  if (!Number.isFinite(amountAzn) || amountAzn <= 0) {
    return NextResponse.json({ error: "Səhv məbləğ" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "Boş fayl" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Fayl çox böyükdür (max 5 MB)" },
      { status: 400 }
    );
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json(
      { error: "Yalnız PNG, JPEG, WEBP və PDF qəbul olunur" },
      { status: 400 }
    );
  }

  const uploadsDir = path.join(process.cwd(), "public", "uploads", "receipts");
  if (!existsSync(uploadsDir)) {
    await mkdir(uploadsDir, { recursive: true });
  }

  const ext =
    file.type === "application/pdf"
      ? "pdf"
      : file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
      ? "webp"
      : "jpg";
  const filename = `${user.id}-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadsDir, filename), buffer);

  const receiptUrl = `/uploads/receipts/${filename}`;
  const amountCents = Math.round(amountAzn * 100);

  const tx = await prisma.transaction.create({
    data: {
      userId: user.id,
      type: "DEPOSIT",
      status: "PENDING",
      amountAznCents: amountCents,
      receiptUrl,
      metadata: "manual-bank-transfer",
    },
    select: { id: true, status: true, amountAznCents: true, createdAt: true },
  });

  return NextResponse.json({ ok: true, request: tx });
}
