import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";

const BUCKET = "receipts";
const SIGNED_EXPIRES_SECONDS = 60;

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const id = url.searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const tx = await prisma.transaction.findFirst({
    where: { id, userId: user.id, type: "DEPOSIT" },
    select: { receiptUrl: true },
  });

  if (!tx?.receiptUrl) return NextResponse.json({ error: "Receipt not found" }, { status: 404 });

  // Back-compat: older rows might store a public http(s) URL.
  if (tx.receiptUrl.startsWith("http://") || tx.receiptUrl.startsWith("https://")) {
    return NextResponse.redirect(tx.receiptUrl, 302);
  }

  const path = tx.receiptUrl;

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_EXPIRES_SECONDS);

    if (error || !data?.signedUrl) {
      return NextResponse.json({ error: "Signed URL yaradıla bilmədi" }, { status: 500 });
    }

    return NextResponse.redirect(data.signedUrl, 302);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("wallet/receipt failed", { userId: user.id, id, message: msg, err });
    return NextResponse.json({ error: "Receipt alınmadı" }, { status: 500 });
  }
}

