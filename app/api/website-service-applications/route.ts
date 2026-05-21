import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma/client";
import { calculateAddOnLines, type AddOnSelection } from "@/lib/website-pricing";

export const runtime = "nodejs";

const WEBSITE_TYPES = new Set([
  "BUSINESS",
  "PORTFOLIO",
  "RESTAURANT",
  "ECOMMERCE",
  "LANDING",
  "OTHER",
]);
const URGENCY = new Set(["NORMAL", "URGENT", "FLEXIBLE"]);
const CONTENT_STATUS = new Set(["READY", "PARTIAL", "NEED_HELP"]);
const CONTACT_METHODS = new Set(["WHATSAPP", "CALL", "EMAIL"]);
const LANGUAGES = new Set(["AZ", "EN", "RU", "TR"]);

function normalizeUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  if (!v) return null;
  if (v.length > 500) return v.slice(0, 500);
  return v;
}

function parseStartDate(raw: unknown): Date | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const d = new Date(raw);
  return Number.isFinite(d.getTime()) ? d : null;
}

function pickBool(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  if (v === "true" || v === "yes") return true;
  if (v === "false" || v === "no") return false;
  return null;
}

function normalizeStringList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((v) => String(v ?? "").trim()).filter(Boolean);
  }
  if (typeof raw === "string") {
    return raw
      .split("\n")
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeAddOnSelections(raw: unknown): AddOnSelection[] {
  if (!Array.isArray(raw)) return [];
  const out: AddOnSelection[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const obj = item as { addOnId?: unknown; units?: unknown };
    if (typeof obj.addOnId !== "string" || !obj.addOnId.trim()) continue;
    out.push({
      addOnId: obj.addOnId.trim(),
      units:
        typeof obj.units === "number" && Number.isFinite(obj.units)
          ? Math.max(0, Math.floor(obj.units))
          : 0,
    });
  }
  return out;
}

function toDecimal(v: unknown): Prisma.Decimal | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return new Prisma.Decimal(v);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const businessName =
    typeof body.businessName === "string" ? body.businessName.trim() : "";
  const websiteType =
    typeof body.websiteType === "string" && WEBSITE_TYPES.has(body.websiteType)
      ? body.websiteType
      : "";
  const projectBrief =
    typeof body.projectBrief === "string" ? body.projectBrief.trim() : "";

  if (!fullName || fullName.length < 2) {
    return NextResponse.json({ error: "Ad soyad tələb olunur." }, { status: 400 });
  }
  if (!phone || phone.length < 6) {
    return NextResponse.json({ error: "Telefon nömrəsi tələb olunur." }, { status: 400 });
  }
  if (!websiteType) {
    return NextResponse.json({ error: "Sayt növü seçin." }, { status: 400 });
  }
  if (!projectBrief || projectBrief.length < 10) {
    return NextResponse.json(
      { error: "Layihə haqqında ən azı bir neçə cümlə yazın." },
      { status: 400 },
    );
  }

  // Validate packageId optional reference.
  let packageId: string | null = null;
  if (typeof body.packageId === "string" && body.packageId.trim()) {
    const found = await prisma.websiteServicePackage.findUnique({
      where: { id: body.packageId.trim() },
      select: { id: true },
    });
    packageId = found?.id ?? null;
  }

  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() || null : null;
  const contactMethod =
    typeof body.contactMethod === "string" && CONTACT_METHODS.has(body.contactMethod)
      ? body.contactMethod
      : null;

  const budgetRange =
    typeof body.budgetRange === "string" ? body.budgetRange.trim() || null : null;
  const existingWebsiteUrl = normalizeUrl(body.existingWebsiteUrl);
  const attachmentsUrl = normalizeUrl(body.attachmentsUrl);
  const referenceWebsiteLinks =
    typeof body.referenceWebsiteLinks === "string"
      ? body.referenceWebsiteLinks.trim() || null
      : null;
  const requestedSections = normalizeStringList(body.requestedSections);
  const languages = normalizeStringList(body.languages)
    .map((v) => v.toUpperCase())
    .filter((v) => LANGUAGES.has(v));
  const urgency =
    typeof body.urgency === "string" && URGENCY.has(body.urgency) ? body.urgency : null;
  const designStyle =
    typeof body.designStyle === "string" ? body.designStyle.trim() || null : null;
  const contentStatus =
    typeof body.contentStatus === "string" && CONTENT_STATUS.has(body.contentStatus)
      ? body.contentStatus
      : null;
  const preferredStartDate = parseStartDate(body.preferredStartDate);

  // Add-on snapshot — backend serverdə yenidən hesablayır ki, müştəri
  // qiyməti manipulyasiya edə bilməsin.
  const addOnSelections = normalizeAddOnSelections(body.selectedAddOns);
  const addOnLines = addOnSelections.length
    ? await calculateAddOnLines(addOnSelections)
    : [];

  // AI estimate snapshot — müştəri "Qiymət hesabla" düyməsindən aldığı
  // dəyərlər (yenidən AI çağırmadan saxlayırıq).
  let estimatedPriceMin: Prisma.Decimal | null = null;
  let estimatedPriceMax: Prisma.Decimal | null = null;
  let estimateBreakdown: Prisma.InputJsonValue | undefined;
  if (body.estimate && typeof body.estimate === "object") {
    const est = body.estimate as {
      total?: { min?: unknown; max?: unknown };
      baseRange?: unknown;
      complexityFactor?: unknown;
      reasoning?: unknown;
      source?: unknown;
    };
    estimatedPriceMin = toDecimal(est.total?.min);
    estimatedPriceMax = toDecimal(est.total?.max);
    estimateBreakdown = {
      baseRange: Array.isArray(est.baseRange) ? est.baseRange : null,
      complexityFactor:
        typeof est.complexityFactor === "number" ? est.complexityFactor : null,
      reasoning: typeof est.reasoning === "string" ? est.reasoning : null,
      source: typeof est.source === "string" ? est.source : null,
    } as Prisma.InputJsonValue;
  }

  const created = await prisma.websiteServiceApplication.create({
    data: {
      fullName,
      phone,
      email,
      contactMethod,
      businessName: businessName || null,
      websiteType,
      packageId,
      budgetRange,
      hasLogo: pickBool(body.hasLogo),
      hasDomain: pickBool(body.hasDomain),
      hasHosting: pickBool(body.hasHosting),
      projectBrief,
      existingWebsiteUrl,
      referenceWebsiteLinks,
      attachmentsUrl,
      requestedSections: requestedSections.length
        ? (requestedSections as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      languages: languages.length
        ? (languages as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      preferredStartDate,
      urgency,
      wantsCustomDesign: pickBool(body.wantsCustomDesign),
      designStyle,
      contentStatus,
      selectedAddOns: addOnLines.length
        ? (addOnLines as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      estimatedPriceMin,
      estimatedPriceMax,
      estimateBreakdown: estimateBreakdown ?? Prisma.JsonNull,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: created.id });
}
