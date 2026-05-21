import { NextResponse } from "next/server";
import {
  estimateProjectPrice,
  type AddOnSelection,
  type EstimateInput,
} from "@/lib/website-pricing";

export const runtime = "nodejs";

const WEBSITE_TYPES = new Set([
  "BUSINESS",
  "PORTFOLIO",
  "RESTAURANT",
  "ECOMMERCE",
  "LANDING",
  "OTHER",
]);

function pickBool(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  if (v === "true" || v === "yes") return true;
  if (v === "false" || v === "no") return false;
  return null;
}

function normSelections(raw: unknown): AddOnSelection[] {
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

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  const websiteType =
    typeof body.websiteType === "string" && WEBSITE_TYPES.has(body.websiteType)
      ? body.websiteType
      : "";
  const projectBrief =
    typeof body.projectBrief === "string" ? body.projectBrief.trim() : "";

  if (!websiteType) {
    return NextResponse.json({ error: "Sayt növü seçin." }, { status: 400 });
  }
  if (!projectBrief || projectBrief.length < 10) {
    return NextResponse.json(
      { error: "Qiymət hesablamaq üçün layihə haqqında ən azı bir neçə cümlə yazın." },
      { status: 400 },
    );
  }

  const languages: string[] = Array.isArray(body.languages)
    ? body.languages.map((v: unknown) => String(v ?? "").toUpperCase()).filter(Boolean)
    : [];

  const input: EstimateInput = {
    websiteType,
    projectBrief,
    contentStatus:
      typeof body.contentStatus === "string" ? body.contentStatus : null,
    urgency: typeof body.urgency === "string" ? body.urgency : null,
    wantsCustomDesign: pickBool(body.wantsCustomDesign),
    hasLogo: pickBool(body.hasLogo),
    hasDomain: pickBool(body.hasDomain),
    hasHosting: pickBool(body.hasHosting),
    languages,
    selectedAddOns: normSelections(body.selectedAddOns),
  };

  try {
    const result = await estimateProjectPrice(input);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[estimate] error:", err);
    return NextResponse.json(
      { error: "Qiymət hesablanmadı. Bir az sonra yenidən cəhd edin." },
      { status: 500 },
    );
  }
}
