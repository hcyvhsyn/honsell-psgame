import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createImageUploadTarget } from "@/lib/imageUploadServer";

export const runtime = "nodejs";

const TYPES = new Set(["PUBG_UC", "POINT_BLANK_TG"]);

export async function POST(req: Request) {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const type = String(body.type ?? "").toUpperCase();
  if (!TYPES.has(type)) {
    return NextResponse.json({ error: "type düzgün deyil" }, { status: 400 });
  }
  const slug = type === "PUBG_UC" ? "pubg-uc" : "point-blank-tg";

  const res = await createImageUploadTarget({
    contentType: String(body.contentType ?? ""),
    prefix: `in-game-credit/${slug}`,
    supabaseBucket: "service-images",
    fileSizeLimit: 5 * 1024 * 1024,
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json(res);
}
