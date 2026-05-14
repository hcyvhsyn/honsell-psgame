import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_SEARCH_SUGGESTIONS,
  SEARCH_SUGGESTION_ICON_KEYS,
  type SearchSuggestionDto,
} from "@/lib/searchSuggestions";

export const runtime = "nodejs";
export const revalidate = 60;

export async function GET() {
  const rows = await prisma.searchSuggestion.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, label: true, iconKey: true },
  });

  if (rows.length === 0) {
    return NextResponse.json({ suggestions: DEFAULT_SEARCH_SUGGESTIONS });
  }

  const suggestions: SearchSuggestionDto[] = rows.map((r) => ({
    id: r.id,
    label: r.label,
    iconKey: (SEARCH_SUGGESTION_ICON_KEYS.includes(r.iconKey as never)
      ? r.iconKey
      : "SEARCH") as SearchSuggestionDto["iconKey"],
  }));
  return NextResponse.json({ suggestions });
}
