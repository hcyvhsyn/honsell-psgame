import { prisma } from "@/lib/prisma";
import { getOpenAI, isOpenAIConfigured } from "@/lib/openai";

export type AddOnPricingType = "FLAT" | "PER_UNIT";

export type AddOnSelection = { addOnId: string; units?: number };

export type AddOnLine = {
  addOnId: string;
  slug: string;
  name: string;
  pricingType: AddOnPricingType;
  units: number;
  unitPrice: number | null;
  freeUnits: number | null;
  flatPrice: number | null;
  lineTotal: number;
  note?: string;
};

export type BaseRanges = Record<
  string,
  { minBase: number; maxBase: number; notes?: string }
>;

export type EstimateInput = {
  websiteType: string;
  projectBrief: string;
  contentStatus: string | null;
  urgency: string | null;
  wantsCustomDesign: boolean | null;
  hasLogo: boolean | null;
  hasDomain: boolean | null;
  hasHosting: boolean | null;
  languages: string[];
  selectedAddOns: AddOnSelection[];
};

export type EstimateResult = {
  baseRange: [number, number];
  complexityFactor: number;
  reasoning: string;
  addOnLines: AddOnLine[];
  addOnsTotal: number;
  total: { min: number; max: number };
  source: "ai" | "fallback";
};

function toNum(v: unknown): number {
  if (typeof v === "number") return v;
  if (v && typeof v === "object" && "toNumber" in v) {
    return (v as { toNumber: () => number }).toNumber();
  }
  return Number(v) || 0;
}

function round(n: number): number {
  return Math.round(n);
}

export async function calculateAddOnLines(
  selections: AddOnSelection[],
): Promise<AddOnLine[]> {
  const ids = Array.from(new Set(selections.map((s) => s.addOnId).filter(Boolean)));
  if (ids.length === 0) return [];

  const rows = await prisma.websiteServiceAddOn.findMany({
    where: { id: { in: ids }, isActive: true },
  });
  const map = new Map(rows.map((r) => [r.id, r]));

  const lines: AddOnLine[] = [];
  for (const sel of selections) {
    const row = map.get(sel.addOnId);
    if (!row) continue;
    const pricingType = row.pricingType as AddOnPricingType;

    if (pricingType === "FLAT") {
      const flat = toNum(row.flatPrice);
      lines.push({
        addOnId: row.id,
        slug: row.slug,
        name: row.name,
        pricingType,
        units: 1,
        unitPrice: null,
        freeUnits: null,
        flatPrice: flat,
        lineTotal: flat,
      });
      continue;
    }

    // PER_UNIT
    const units = Math.max(0, Math.floor(sel.units ?? 0));
    const freeUnits = row.freeUnits ?? 0;
    const unitPrice = toNum(row.unitPrice);
    const billable = Math.max(0, units - freeUnits);
    const lineTotal = billable * unitPrice;
    lines.push({
      addOnId: row.id,
      slug: row.slug,
      name: row.name,
      pricingType,
      units,
      unitPrice,
      freeUnits,
      flatPrice: null,
      lineTotal,
      note:
        freeUnits > 0
          ? `${freeUnits} ${row.unitLabel ?? "vahid"} pulsuz daxildir`
          : undefined,
    });
  }

  return lines;
}

function fallbackEstimate(
  input: EstimateInput,
  baseRanges: BaseRanges,
): { baseRange: [number, number]; complexityFactor: number; reasoning: string } {
  const range = baseRanges[input.websiteType] ?? baseRanges.OTHER;
  let factor = 1.0;
  const briefLen = input.projectBrief.length;
  if (briefLen > 400) factor += 0.1;
  if (briefLen > 800) factor += 0.1;
  if (input.wantsCustomDesign) factor += 0.15;
  if (input.contentStatus === "NEED_HELP") factor += 0.1;
  if (input.urgency === "URGENT") factor += 0.15;
  return {
    baseRange: [
      range?.minBase ?? 200,
      range?.maxBase ?? 500,
    ],
    complexityFactor: Math.min(factor, 2.0),
    reasoning:
      "Hesablama qaydaları ilə (OpenAI mövcud deyil) hesablandı — briefin uzunluğu və xüsusi tələblərə görə əmsal tətbiq edildi.",
  };
}

const AI_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["baseMin", "baseMax", "complexityFactor", "reasoning"],
  properties: {
    baseMin: { type: "number" },
    baseMax: { type: "number" },
    complexityFactor: { type: "number" },
    reasoning: { type: "string" },
  },
} as const;

async function callOpenAIForBase(
  input: EstimateInput,
  baseRanges: BaseRanges,
  aiInstructions: string | null,
  model: string,
): Promise<{ baseRange: [number, number]; complexityFactor: number; reasoning: string }> {
  const client = getOpenAI();
  const systemPrompt = [
    "Sən bir veb-studio üçün qiymət hesablayan köməkçisən.",
    "Cavablar həmişə Azərbaycan dilində və qısa olmalıdır.",
    "Sənə layihə brifi və hazır qiymət konfiqurasiyası verilir.",
    "Verilən baza qiymət aralığından KƏNARA ÇIXMA — yalnız o aralıqdan dəyər qaytar.",
    "complexityFactor 0.8–2.0 aralığında ola bilər: sadə layihələrdə 1.0, mürəkkəbdə daha yüksək.",
    "AZN valyutasında işləyirik. Cavabı yalnız tələb olunan JSON sxemasında qaytar.",
    aiInstructions ? `Əlavə qaydalar: ${aiInstructions}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const range = baseRanges[input.websiteType] ?? baseRanges.OTHER ?? {
    minBase: 200,
    maxBase: 500,
  };

  const userPayload = {
    websiteType: input.websiteType,
    baseRange: { min: range.minBase, max: range.maxBase },
    projectBrief: input.projectBrief,
    contentStatus: input.contentStatus,
    urgency: input.urgency,
    wantsCustomDesign: input.wantsCustomDesign,
    languagesCount: input.languages.length,
    has: {
      logo: input.hasLogo,
      domain: input.hasDomain,
      hosting: input.hasHosting,
    },
  };

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.2,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content:
          "Bu layihə üçün baza qiymət aralığını və mürəkkəblik əmsalını hesabla:\n" +
          JSON.stringify(userPayload, null, 2),
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "PriceEstimate",
        strict: true,
        schema: AI_SCHEMA,
      },
    },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("AI cavabı boş gəldi.");
  const parsed = JSON.parse(content) as {
    baseMin: number;
    baseMax: number;
    complexityFactor: number;
    reasoning: string;
  };

  const minB = Math.max(range.minBase, Math.min(parsed.baseMin, range.maxBase));
  const maxB = Math.max(minB, Math.min(parsed.baseMax, range.maxBase));
  const factor = Math.max(0.8, Math.min(parsed.complexityFactor, 2.0));

  return {
    baseRange: [minB, maxB],
    complexityFactor: factor,
    reasoning: parsed.reasoning,
  };
}

export async function estimateProjectPrice(
  input: EstimateInput,
): Promise<EstimateResult> {
  const config = await prisma.websitePricingConfig.findUnique({
    where: { id: "default" },
  });
  const baseRanges: BaseRanges = (config?.baseRanges as BaseRanges) ?? {
    OTHER: { minBase: 200, maxBase: 500 },
  };

  const addOnLines = await calculateAddOnLines(input.selectedAddOns);
  const addOnsTotal = addOnLines.reduce((acc, l) => acc + l.lineTotal, 0);

  let source: "ai" | "fallback" = "fallback";
  let aiPart = fallbackEstimate(input, baseRanges);

  if (isOpenAIConfigured()) {
    try {
      aiPart = await callOpenAIForBase(
        input,
        baseRanges,
        config?.aiInstructions ?? null,
        config?.aiModel ?? "gpt-4o-mini",
      );
      source = "ai";
    } catch (err) {
      console.warn("[website-pricing] AI fallback:", err);
      source = "fallback";
    }
  }

  const adjustedMin = aiPart.baseRange[0] * aiPart.complexityFactor;
  const adjustedMax = aiPart.baseRange[1] * aiPart.complexityFactor;

  return {
    baseRange: aiPart.baseRange,
    complexityFactor: aiPart.complexityFactor,
    reasoning: aiPart.reasoning,
    addOnLines,
    addOnsTotal: round(addOnsTotal),
    total: {
      min: round(adjustedMin + addOnsTotal),
      max: round(adjustedMax + addOnsTotal),
    },
    source,
  };
}
