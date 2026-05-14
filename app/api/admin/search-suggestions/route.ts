import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { SEARCH_SUGGESTION_ICON_KEYS } from "@/lib/searchSuggestions";

export const runtime = "nodejs";

function revalidateAll() {
  revalidatePath("/");
}

export async function GET() {
  await requireAdmin();
  const rows = await prisma.searchSuggestion.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  await requireAdmin();
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const { action } = body;

  if (action === "UPSERT") {
    const id = typeof body.id === "string" ? body.id : null;
    const label = String(body.label ?? "").trim();
    const iconKey = String(body.iconKey ?? "SEARCH");
    const isActive = body.isActive !== false;
    const sortOrder = Number(body.sortOrder ?? 0);

    if (!label) {
      return NextResponse.json({ error: "Mətn (label) tələb olunur." }, { status: 400 });
    }
    if (!SEARCH_SUGGESTION_ICON_KEYS.includes(iconKey as never)) {
      return NextResponse.json({ error: "İkon düzgün deyil." }, { status: 400 });
    }

    const payload = {
      label: label.slice(0, 60),
      iconKey,
      isActive,
      sortOrder: Number.isFinite(sortOrder) ? Math.round(sortOrder) : 0,
    };

    const row = id
      ? await prisma.searchSuggestion.update({ where: { id }, data: payload })
      : await prisma.searchSuggestion.create({ data: payload });
    revalidateAll();
    return NextResponse.json(row);
  }

  if (action === "DELETE") {
    const id = typeof body.id === "string" ? body.id : null;
    if (!id) return NextResponse.json({ error: "id tələb olunur" }, { status: 400 });
    await prisma.searchSuggestion.delete({ where: { id } });
    revalidateAll();
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Bilinməyən action" }, { status: 400 });
}
