import { NextResponse } from "next/server";
import { getReferralCalculatorOptions } from "@/lib/referralCalculatorOptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const options = await getReferralCalculatorOptions();
  return NextResponse.json({ options });
}
