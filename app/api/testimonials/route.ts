import { NextRequest, NextResponse } from "next/server";
import { getPublicTestimonials } from "@/lib/publicTestimonials";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const page = Number(params.get("page") ?? "1");
  const ratingValue = Number(params.get("rating") ?? "0");

  try {
    const result = await getPublicTestimonials({
      page: Number.isFinite(page) ? page : 1,
      query: params.get("q") ?? "",
      platform: params.get("platform") ?? "",
      rating: ratingValue >= 1 && ratingValue <= 5 ? ratingValue : null,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("public testimonials failed", error);
    return NextResponse.json({ error: "Rəyləri yükləmək alınmadı." }, { status: 500 });
  }
}
