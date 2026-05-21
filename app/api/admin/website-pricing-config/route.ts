import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { Prisma } from "@/lib/generated/prisma/client";

export const runtime = "nodejs";

const ALLOWED_TYPES = [
  "BUSINESS",
  "PORTFOLIO",
  "RESTAURANT",
  "ECOMMERCE",
  "LANDING",
  "OTHER",
] as const;

type Range = { minBase: number; maxBase: number; notes?: string };

function normalizeBaseRanges(raw: unknown): Record<string, Range> | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const out: Record<string, Range> = {};
  for (const key of ALLOWED_TYPES) {
    const v = obj[key];
    if (!v || typeof v !== "object") continue;
    const r = v as Record<string, unknown>;
    const min = Number(r.minBase);
    const max = Number(r.maxBase);
    if (!Number.isFinite(min) || !Number.isFinite(max)) continue;
    out[key] = {
      minBase: Math.max(0, min),
      maxBase: Math.max(Math.max(0, min), max),
      notes: typeof r.notes === "string" ? r.notes : undefined,
    };
  }
  return out;
}

export async function GET() {
  await requireAdmin();
  const config = await prisma.websitePricingConfig.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      baseRanges: {
        OTHER: { minBase: 200, maxBase: 500 },
      },
    },
  });
  return NextResponse.json({ config });
}

export async function PUT(req: Request) {
  await requireAdmin();
  const body = await req.json().catch(() => ({}));

  const baseRanges = normalizeBaseRanges(body.baseRanges);
  if (!baseRanges) {
    return NextResponse.json(
      { error: "baseRanges düzgün formatda deyil." },
      { status: 400 },
    );
  }

  const aiInstructions =
    typeof body.aiInstructions === "string"
      ? body.aiInstructions.trim() || null
      : null;
  const aiModel =
    typeof body.aiModel === "string" && body.aiModel.trim()
      ? body.aiModel.trim()
      : "gpt-4o-mini";

  const config = await prisma.websitePricingConfig.upsert({
    where: { id: "default" },
    update: {
      baseRanges: baseRanges as unknown as Prisma.InputJsonValue,
      aiInstructions,
      aiModel,
    },
    create: {
      id: "default",
      baseRanges: baseRanges as unknown as Prisma.InputJsonValue,
      aiInstructions,
      aiModel,
    },
  });
  return NextResponse.json({ ok: true, config });
}
