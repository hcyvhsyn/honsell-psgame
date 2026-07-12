import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createStudentCardUploadTarget } from "@/lib/imageUploadServer";

export const runtime = "nodejs";

/**
 * Tələbə kartı üçün presigned upload hədəfi yaradır. Fayl PRIVATE saxlanılır;
 * qaytarılan `key` client tərəfindən yükləmədən sonra PATCH /api/profile/student
 * ilə DB-yə (studentCardKey) yazılır. Sahiblik key prefiksi ilə qorunur.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const res = await createStudentCardUploadTarget({
    contentType: String(body.contentType ?? ""),
    userId: user.id,
  });
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }
  return NextResponse.json(res);
}
