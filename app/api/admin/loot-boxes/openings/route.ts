import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth";
import { getAdminOpenings, LOOT_BOX_OUTCOMES } from "@/lib/lootBoxes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Kim nə qazandı — admin siyahısı.
 *
 * Ayrı endpoint-dir (əsas `/api/admin/loot-boxes` GET-inə qoşulmur), çünki
 * açılışlar yüzlərlə ola bilər və hər qutu üçün hamısını yükləmək panelin
 * açılışını ağırlaşdırardı. Buna görə tələb olunanda, səhifə-səhifə gəlir.
 */
export async function GET(req: Request) {
  await requireAdmin();

  const url = new URL(req.url);
  const lootBoxId = url.searchParams.get("boxId") ?? "";
  if (!lootBoxId) {
    return NextResponse.json({ error: "boxId tələb olunur." }, { status: 400 });
  }

  const outcomeRaw = url.searchParams.get("outcome") ?? "";
  const outcome = (LOOT_BOX_OUTCOMES as readonly string[]).includes(outcomeRaw) ? outcomeRaw : undefined;

  const take = Math.min(200, Math.max(1, Number(url.searchParams.get("take")) || 50));
  const skip = Math.max(0, Number(url.searchParams.get("skip")) || 0);

  const { rows, total } = await getAdminOpenings({
    lootBoxId,
    outcome,
    search: url.searchParams.get("q") ?? undefined,
    take,
    skip,
  });

  return NextResponse.json({ rows, total, take, skip });
}
