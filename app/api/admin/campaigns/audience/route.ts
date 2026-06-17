import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { resolveCampaignAudience, type CampaignAudienceFilters } from "@/lib/campaigns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST → verilmiş filtr + əllə seçimə görə auditoriyanı həll edir.
 * Cavab: { total, withEmail, withPhone, unsubscribed, sample[] }
 */
export async function POST(req: Request) {
  await requireAdmin();
  const body = await req.json().catch(() => ({}));

  const filters: CampaignAudienceFilters =
    body.filters && typeof body.filters === "object" ? body.filters : {};
  const includeUserIds: string[] = Array.isArray(body.includeUserIds)
    ? body.includeUserIds.filter((x: unknown): x is string => typeof x === "string")
    : [];
  const excludeUserIds: string[] = Array.isArray(body.excludeUserIds)
    ? body.excludeUserIds.filter((x: unknown): x is string => typeof x === "string")
    : [];
  const cooldownDays =
    typeof body.cooldownDays === "number" && body.cooldownDays >= 0 ? body.cooldownDays : 0;

  const { recipients, cooledDownCount } = await resolveCampaignAudience({
    filters,
    includeUserIds,
    excludeUserIds,
    cooldownDays,
  });

  const withEmail = recipients.filter((r) => r.emailVerified && !r.marketingUnsubscribedAt).length;
  const withPhone = recipients.filter((r) => !!r.phone).length;
  const unsubscribed = recipients.filter((r) => !!r.marketingUnsubscribedAt).length;

  return NextResponse.json({
    total: recipients.length,
    withEmail,
    withPhone,
    unsubscribed,
    cooledDown: cooledDownCount,
    sample: recipients.slice(0, 20).map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      phone: r.phone,
      emailVerified: r.emailVerified,
      unsubscribed: !!r.marketingUnsubscribedAt,
    })),
  });
}
