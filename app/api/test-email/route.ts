import { NextResponse } from "next/server";
import { sendWelcomeEmail } from "@/lib/resend";

const TEST_RECIPIENT = "huseynhajiyev0@gmail.com";
const TEST_USER_NAME = "Huseyn";

async function trigger() {
  try {
    const data = await sendWelcomeEmail(TEST_RECIPIENT, TEST_USER_NAME);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET() {
  return trigger();
}

export async function POST() {
  return trigger();
}
