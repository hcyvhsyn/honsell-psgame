import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import {
  ACTIVATION_SCOPE_PATHS,
  ACTIVATION_STEP_SCOPES,
  isValidActivationScope,
} from "@/lib/contentScopes";
import { ACTIVATION_STEPS_TAG } from "@/lib/activationSteps";

export const runtime = "nodejs";

/**
 * Public səhifələr ISR-dir (`revalidate = 1800`) və addımlar `unstable_cache`
 * arxasındadır — ona görə HƏR mutasiyadan sonra HƏM tag, HƏM path sıfırlanır.
 * Yalnız biri kifayət etmir: tag keşlənmiş data-nı, path render edilmiş HTML-i
 * təzələyir.
 */
function revalidateSteps() {
  revalidateTag(ACTIVATION_STEPS_TAG);
  for (const scope of ACTIVATION_STEP_SCOPES) {
    const path = ACTIVATION_SCOPE_PATHS[scope.key];
    if (path) revalidatePath(path);
  }
}

export async function GET(req: Request) {
  await requireAdmin();
  const url = new URL(req.url);
  const scope = url.searchParams.get("scope");
  const items = await prisma.activationStep.findMany({
    where: scope && isValidActivationScope(scope) ? { scope } : {},
    orderBy: [{ scope: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  await requireAdmin();
  const body = await req.json().catch(() => ({}));
  const { action } = body;

  try {
    if (action === "UPSERT") {
      const { id, scope, method, title, body: text, imageUrl, isActive, sortOrder } = body;
      if (!title || typeof title !== "string" || !title.trim()) {
        return NextResponse.json({ error: "Başlıq tələb olunur" }, { status: 400 });
      }
      if (!isValidActivationScope(String(scope))) {
        return NextResponse.json({ error: "Düzgün scope seçin" }, { status: 400 });
      }

      const payload = {
        scope: String(scope),
        // Trim məcburidir: " Brauzer" ilə "Brauzer" public-də İKİ ayrı tab olardı.
        method: method && String(method).trim() ? String(method).trim() : null,
        title: String(title).trim(),
        body: text && String(text).trim() ? String(text).trim() : null,
        imageUrl: imageUrl && String(imageUrl).trim() ? String(imageUrl).trim() : null,
        isActive: Boolean(isActive ?? true),
        sortOrder: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0,
      };

      const item = id
        ? await prisma.activationStep.update({ where: { id: String(id) }, data: payload })
        : await prisma.activationStep.create({ data: payload });
      revalidateSteps();
      return NextResponse.json(item);
    }

    if (action === "TOGGLE_ACTIVE") {
      const { id, isActive } = body;
      if (!id) return NextResponse.json({ error: "id tələb olunur" }, { status: 400 });
      const item = await prisma.activationStep.update({
        where: { id: String(id) },
        data: { isActive: Boolean(isActive) },
      });
      revalidateSteps();
      return NextResponse.json(item);
    }

    if (action === "REORDER") {
      // Sıra addımların MƏNASIDIR (1, 2, 3…) — ona görə bütün siyahı bir
      // tranzaksiyada yazılır, yarımçıq sıralama public-ə çıxmasın.
      const ids: unknown = body.ids;
      if (!Array.isArray(ids) || ids.length === 0) {
        return NextResponse.json({ error: "ids massivi tələb olunur" }, { status: 400 });
      }
      await prisma.$transaction(
        ids.map((id, i) =>
          prisma.activationStep.update({ where: { id: String(id) }, data: { sortOrder: i } }),
        ),
      );
      revalidateSteps();
      return NextResponse.json({ ok: true });
    }

    if (action === "DELETE") {
      const { id } = body;
      if (!id) return NextResponse.json({ error: "id tələb olunur" }, { status: 400 });
      await prisma.activationStep.delete({ where: { id: String(id) } });
      revalidateSteps();
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Bilinməyən action" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Xəta baş verdi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
