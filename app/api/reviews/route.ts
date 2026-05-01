import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const rating = Math.max(1, Math.min(5, Number(body.rating) || 0));
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const platformRaw = typeof body.platform === "string" ? body.platform : "";
    const platform =
      platformRaw === "GAME" ||
      platformRaw === "PS_PLUS" ||
      platformRaw === "GIFT_CARD" ||
      platformRaw === "ACCOUNT_CREATION"
        ? platformRaw
        : "GAME";

    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Ulduz dərəcəsi səhvdir." }, { status: 400 });
    }
    if (text.length < 10) {
      return NextResponse.json({ error: "Rəy ən azı 10 simvol olmalıdır." }, { status: 400 });
    }
    if (text.length > 1000) {
      return NextResponse.json({ error: "Rəy çox uzundur (max 1000 simvol)." }, { status: 400 });
    }

    // Store as inactive testimonial; admin can activate later.
    // Fallback: if prod DB is missing the new `platform` column, insert without it.
    try {
      await prisma.testimonial.create({
        data: {
          name: user.name ?? user.email.split("@")[0],
          text,
          rating,
          platform,
          isActive: false,
          sortOrder: 0,
          avatarUrl: null,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const looksLikeMissingColumn =
        msg.toLowerCase().includes("platform") &&
        (msg.toLowerCase().includes("column") || msg.toLowerCase().includes("does not exist"));
      if (!looksLikeMissingColumn) throw err;

      await prisma.testimonial.create({
        data: {
          name: user.name ?? user.email.split("@")[0],
          text,
          rating,
          isActive: false,
          sortOrder: 0,
          avatarUrl: null,
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("api/reviews failed", { userId: user.id, message: msg, err });
    return NextResponse.json(
      {
        error: "Rəy göndərmək alınmadı.",
        hint: msg.toLowerCase().includes("platform")
          ? "DB migration tətbiq edilməyib ola bilər (Testimonial.platform)."
          : undefined,
      },
      { status: 500 }
    );
  }
}

