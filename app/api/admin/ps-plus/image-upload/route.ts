import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createImageUploadTarget } from "@/lib/imageUploadServer";

export const runtime = "nodejs";

const TIERS = new Set(["ESSENTIAL", "EXTRA", "DELUXE"]);

export async function POST(req: Request) {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const tier = String(body.tier ?? "").toUpperCase();
  if (!TIERS.has(tier)) {
    return NextResponse.json({ error: "Tier düzgün deyil" }, { status: 400 });
  }

  const res = await createImageUploadTarget({
    contentType: String(body.contentType ?? ""),
    prefix: `ps-plus/${tier}`,
    supabaseBucket: "service-images",
    fileSizeLimit: 5 * 1024 * 1024,
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json(res);
}
