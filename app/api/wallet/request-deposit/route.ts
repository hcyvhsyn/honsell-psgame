import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    { error: "Manual depozit sorğusu ləğv edilib. Balansı Epoint ilə artırın." },
    { status: 410 },
  );
}
