import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { ENTRY_CONDITIONS, SOCIAL_PLATFORMS, type EntryCondition } from "@/lib/giveaways";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET → bütün çəkilişlər (iştirakçı sayı ilə). */
export async function GET() {
  await requireAdmin();
  const giveaways = await prisma.giveaway.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      createdBy: { select: { name: true, email: true } },
      _count: { select: { entries: true } },
    },
  });
  return NextResponse.json({ giveaways });
}

function parseBody(body: Record<string, unknown>) {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() || null : null;
  const prizeLabel = typeof body.prizeLabel === "string" ? body.prizeLabel.trim() : "";
  const prizeImageUrl =
    typeof body.prizeImageUrl === "string" ? body.prizeImageUrl.trim() || null : null;
  const winnersCount =
    typeof body.winnersCount === "number" && body.winnersCount >= 1
      ? Math.floor(body.winnersCount)
      : 1;
  const entryCondition: EntryCondition = ENTRY_CONDITIONS.includes(body.entryCondition as EntryCondition)
    ? (body.entryCondition as EntryCondition)
    : "REGISTER_ONLY";
  // PURCHASE_PRODUCT → məhsul tipi; FOLLOW_SOCIAL → platforma kodu.
  const conditionType =
    (entryCondition === "PURCHASE_PRODUCT" || entryCondition === "FOLLOW_SOCIAL") &&
    typeof body.conditionType === "string"
      ? body.conditionType.trim() || null
      : null;
  const conditionUrl =
    entryCondition === "FOLLOW_SOCIAL" && typeof body.conditionUrl === "string"
      ? body.conditionUrl.trim() || null
      : null;
  const isVip = Boolean(body.isVip);
  const participantBoost =
    typeof body.participantBoost === "number" && body.participantBoost >= 0
      ? Math.floor(body.participantBoost)
      : 0;
  const endAt = typeof body.endAt === "string" ? new Date(body.endAt) : null;
  // Xərc şərti yalnız PURCHASE_MIN_AMOUNT üçün; bilet vahidi hər hansı şərtdə optional.
  const minSpendAznCents =
    entryCondition === "PURCHASE_MIN_AMOUNT" &&
    typeof body.minSpendAznCents === "number" &&
    body.minSpendAznCents > 0
      ? Math.floor(body.minSpendAznCents)
      : null;
  const ticketUnitAznCents =
    typeof body.ticketUnitAznCents === "number" && body.ticketUnitAznCents > 0
      ? Math.floor(body.ticketUnitAznCents)
      : null;

  return {
    title,
    description,
    prizeLabel,
    prizeImageUrl,
    winnersCount,
    entryCondition,
    conditionType,
    conditionUrl,
    isVip,
    participantBoost,
    minSpendAznCents,
    ticketUnitAznCents,
    endAt,
  };
}

/** POST → yeni çəkiliş yarat (default DRAFT). */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  const body = await req.json().catch(() => ({}));
  const data = parseBody(body);

  if (!data.title) return NextResponse.json({ error: "Başlıq boş ola bilməz." }, { status: 400 });
  if (!data.prizeLabel)
    return NextResponse.json({ error: "Mükafat etiketi boş ola bilməz." }, { status: 400 });
  if (!data.endAt || Number.isNaN(data.endAt.getTime()))
    return NextResponse.json({ error: "Bitiş tarixi düzgün deyil." }, { status: 400 });
  if (data.entryCondition === "PURCHASE_PRODUCT" && !data.conditionType)
    return NextResponse.json({ error: "Məhsul şərti üçün məhsul tipi seçilməlidir." }, { status: 400 });
  if (data.entryCondition === "PURCHASE_MIN_AMOUNT" && !data.minSpendAznCents)
    return NextResponse.json({ error: "Minimum xərc şərti üçün məbləğ daxil edilməlidir." }, { status: 400 });
  if (data.entryCondition === "FOLLOW_SOCIAL") {
    if (!SOCIAL_PLATFORMS.some((p) => p.value === data.conditionType))
      return NextResponse.json({ error: "İzləmə şərti üçün platforma seçilməlidir." }, { status: 400 });
    if (!data.conditionUrl || !/^https?:\/\//i.test(data.conditionUrl))
      return NextResponse.json(
        { error: "İzləmə şərti üçün düzgün link (https://...) daxil edilməlidir." },
        { status: 400 }
      );
  }

  const status = body.status === "ACTIVE" ? "ACTIVE" : "DRAFT";

  const giveaway = await prisma.giveaway.create({
    data: {
      title: data.title,
      description: data.description,
      prizeLabel: data.prizeLabel,
      prizeImageUrl: data.prizeImageUrl,
      winnersCount: data.winnersCount,
      entryCondition: data.entryCondition,
      conditionType: data.conditionType,
      conditionUrl: data.conditionUrl,
      isVip: data.isVip,
      participantBoost: data.participantBoost,
      minSpendAznCents: data.minSpendAznCents,
      ticketUnitAznCents: data.ticketUnitAznCents,
      endAt: data.endAt,
      status,
      createdById: admin.id,
    },
  });

  return NextResponse.json({ giveaway });
}
