import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { sendAdminDepositNotification } from "@/lib/resend";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "application/pdf"]);
const BUCKET = "receipts";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const ct = req.headers.get("content-type") ?? "";

    let amountAzn: number | null = null;
    let receiptPath: string | null = null;
    let receiptUrl: string | null = null;

    if (ct.includes("application/json")) {
      const body = await req.json().catch(() => ({}));
      amountAzn = Number(body.amountAzn);
      receiptPath = typeof body.receiptPath === "string" ? body.receiptPath : null;
    } else {
      // Back-compat: accept multipart/form-data, but this path may hit Vercel 413.
      const form = await req.formData().catch(() => null);
      if (!form) {
        return NextResponse.json({ error: "Form məlumatı oxunmadı" }, { status: 400 });
      }
      amountAzn = Number(form.get("amountAzn"));
      const f = form.get("receipt");
      if (!(f instanceof File)) {
        return NextResponse.json({ error: "Qəbz şəkli tələb olunur" }, { status: 400 });
      }
      const file = f;

      if (file.size === 0) return NextResponse.json({ error: "Boş fayl" }, { status: 400 });
      if (file.size > MAX_BYTES) {
        return NextResponse.json({ error: "Fayl çox böyükdür (max 5 MB)" }, { status: 400 });
      }
      if (!ALLOWED.has(file.type)) {
        return NextResponse.json(
          { error: "Yalnız PNG, JPEG, WEBP və PDF qəbul olunur" },
          { status: 400 }
        );
      }

      const ext =
        file.type === "application/pdf"
          ? "pdf"
          : file.type === "image/png"
            ? "png"
            : file.type === "image/webp"
              ? "webp"
              : "jpg";
      receiptPath = `${user.id}/${Date.now()}.${ext}`;

      const supabase = getSupabaseAdmin();
      const bytes = new Uint8Array(await file.arrayBuffer());
      const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(receiptPath, bytes, {
        upsert: false,
        contentType: file.type,
        cacheControl: "3600",
      });
      if (uploadErr) throw new Error(`Supabase upload failed: ${uploadErr.message}`);
    }

    if (!Number.isFinite(amountAzn) || (amountAzn ?? 0) <= 0) {
      return NextResponse.json({ error: "Səhv məbləğ" }, { status: 400 });
    }
    if (!receiptPath || !receiptPath.startsWith(`${user.id}/`)) {
      return NextResponse.json({ error: "Qəbz tapılmadı" }, { status: 400 });
    }

    // Store storage path in DB; serve it via signed download URL later.
    receiptUrl = receiptPath;
    const amountCents = Math.round(amountAzn * 100);

    const tx = await prisma.transaction.create({
      data: {
        userId: user.id,
        type: "DEPOSIT",
        status: "PENDING",
        amountAznCents: amountCents,
        receiptUrl: receiptUrl ?? undefined,
        metadata: "manual-bank-transfer",
      },
      select: { id: true, status: true, amountAznCents: true, createdAt: true },
    });

    try {
      await sendAdminDepositNotification({
        depositId: tx.id,
        userEmail: user.email,
        userName: user.name,
        amountAzn: amountCents / 100,
      });
    } catch (notifyErr) {
      console.error("admin deposit notify failed", notifyErr);
    }

    return NextResponse.json({ ok: true, request: tx });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("wallet/request-deposit failed", {
      userId: user.id,
      message: msg,
      err,
    });

    // Common production misconfig: missing Supabase service role key or Storage bucket.
    const hint =
      msg.includes("SUPABASE_SERVICE_ROLE_KEY") || msg.includes("NEXT_PUBLIC_SUPABASE_URL")
        ? "Supabase server açarları yoxdur (Vercel env: SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL)."
        : msg.toLowerCase().includes("bucket") || msg.toLowerCase().includes("storage")
          ? `Supabase Storage bucket problemi ola bilər (bucket: "${BUCKET}").`
        : undefined;

    return NextResponse.json(
      { error: "Depozit sorğusu alınmadı.", hint },
      { status: 500 }
    );
  }
}
