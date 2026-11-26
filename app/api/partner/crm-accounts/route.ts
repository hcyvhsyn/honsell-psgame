import { NextResponse } from "next/server";
import { requirePartnerKey } from "@/lib/partnerAuth";
import { ensureCrmAccounts, type CrmAccountInput } from "@/lib/crmAccounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BATCH = 200;

/**
 * CRM → mağaza: CRM müştəriləri üçün sayt hesabı (telefon hesabı) — idempotent.
 *
 * Body: `{ customers: [{ ref, phone, name? }] }` (ən çox 200).
 * Cavab: `{ results: [{ ref, status: "created" | "exists" | "invalid", userId? }] }` — sıra eynidir.
 * Nömrəyə uyğun hesab artıq varsa (son 9 rəqəm) yenisi yaranmır. Heç bir mesaj / e-poçt getmir.
 */
export async function POST(req: Request) {
  const denied = requirePartnerKey(req);
  if (denied) return denied;

  const body = (await req.json().catch(() => null)) as { customers?: unknown } | null;
  const raw = Array.isArray(body?.customers) ? body.customers : null;
  if (!raw) return NextResponse.json({ error: "customers massivi tələb olunur" }, { status: 400 });
  if (raw.length > MAX_BATCH) {
    return NextResponse.json({ error: `Bir sorğuda ən çox ${MAX_BATCH} müştəri` }, { status: 400 });
  }

  const items: CrmAccountInput[] = raw.map((c) => {
    const o = (c ?? {}) as Record<string, unknown>;
    return {
      ref: typeof o.ref === "string" ? o.ref.slice(0, 64) : null,
      phone: typeof o.phone === "string" ? o.phone : "",
      name: typeof o.name === "string" ? o.name : null,
    };
  });

  try {
    const results = await ensureCrmAccounts(items);
    return NextResponse.json({ results }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[partner/crm-accounts]", e);
    return NextResponse.json({ error: "Hesablar yaradılmadı" }, { status: 500 });
  }
}
