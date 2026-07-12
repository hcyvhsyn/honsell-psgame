import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { normalizeStudentCourse } from "@/lib/studentShared";
import { STUDENT_CARD_PREFIX, deleteStudentCard } from "@/lib/imageUploadServer";

export const runtime = "nodejs";

/** Client-ə heç vaxt xam açar (studentCardKey) qaytarılmır — yalnız hasCard flag-i. */
function publicShape(p: {
  isStudent: boolean;
  universityId: string | null;
  course: string | null;
  studentCardKey: string | null;
  verificationStatus: string;
  rejectionReason: string | null;
} | null) {
  return {
    isStudent: p?.isStudent ?? false,
    universityId: p?.universityId ?? null,
    course: p?.course ?? null,
    hasCard: Boolean(p?.studentCardKey),
    verificationStatus: p?.verificationStatus ?? "NOT_SUBMITTED",
    rejectionReason: p?.rejectionReason ?? null,
  };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const profile = await prisma.studentProfile.findUnique({
    where: { userId: user.id },
  });
  return NextResponse.json({ student: publicShape(profile) });
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const existing = await prisma.studentProfile.findUnique({
    where: { userId: user.id },
  });

  // ─── isStudent (toggle) ──────────────────────────────────────────────────
  const isStudent = Boolean(body.isStudent);

  // ─── universitet ─────────────────────────────────────────────────────────
  let universityId: string | null = existing?.universityId ?? null;
  if ("universityId" in body) {
    const raw = body.universityId;
    if (raw === null || raw === "") {
      universityId = null;
    } else if (typeof raw === "string") {
      const uni = await prisma.university.findFirst({
        where: { id: raw, isActive: true },
        select: { id: true },
      });
      if (!uni) {
        return NextResponse.json({ error: "Universitet düzgün deyil" }, { status: 400 });
      }
      universityId = uni.id;
    } else {
      return NextResponse.json({ error: "Universitet düzgün deyil" }, { status: 400 });
    }
  }

  // ─── kurs ────────────────────────────────────────────────────────────────
  let course: string | null = existing?.course ?? null;
  if ("course" in body) {
    if (body.course === null || body.course === "") {
      course = null;
    } else {
      const c = normalizeStudentCourse(body.course);
      if (!c) {
        return NextResponse.json({ error: "Kurs düzgün deyil" }, { status: 400 });
      }
      course = c;
    }
  }

  // ─── tələbə kartı açarı ──────────────────────────────────────────────────
  // Client presign endpoint-dən aldığı açarı göndərir; sahibliyi prefikslə
  // yoxlayırıq. Boş göndərilərsə kart silinir.
  let studentCardKey: string | null = existing?.studentCardKey ?? null;
  if ("studentCardKey" in body) {
    const raw = body.studentCardKey;
    if (raw === null || raw === "") {
      studentCardKey = null;
    } else if (
      typeof raw === "string" &&
      raw.startsWith(`${STUDENT_CARD_PREFIX}/${user.id}/`)
    ) {
      studentCardKey = raw;
    } else {
      return NextResponse.json({ error: "Tələbə kartı açarı düzgün deyil" }, { status: 400 });
    }
  }

  // Köhnə kart faylını təmizlə (açar dəyişib və ya silinib).
  if (existing?.studentCardKey && existing.studentCardKey !== studentCardKey) {
    await deleteStudentCard(existing.studentCardKey);
  }

  // ─── verificationStatus (YALNIZ server hesablayır) ────────────────────────
  const prevStatus = existing?.verificationStatus ?? "NOT_SUBMITTED";
  const complete = Boolean(universityId && course && studentCardKey);
  const dataChanged =
    universityId !== (existing?.universityId ?? null) ||
    course !== (existing?.course ?? null) ||
    studentCardKey !== (existing?.studentCardKey ?? null);

  let verificationStatus = prevStatus;
  let submittedAt: Date | null | undefined = undefined; // undefined → dəyişmə

  if (!isStudent) {
    // Deaktiv: məlumat saxlanılır, status olduğu kimi qalır (eligibility isStudent ilə qorunur).
    verificationStatus = prevStatus;
  } else if (!complete) {
    // Aktivdir, amma tələb olunan sahələr natamam → hələ göndərilməyib.
    verificationStatus = "NOT_SUBMITTED";
  } else if (prevStatus === "VERIFIED" && !dataChanged) {
    verificationStatus = "VERIFIED";
  } else {
    // Tam və (yeni submission və ya dəyişmiş data) → təkrar yoxlamaya.
    verificationStatus = "PENDING";
    if (prevStatus !== "PENDING") submittedAt = new Date();
  }

  const saved = await prisma.studentProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      isStudent,
      universityId,
      course,
      studentCardKey,
      verificationStatus,
      submittedAt: submittedAt ?? null,
    },
    update: {
      isStudent,
      universityId,
      course,
      studentCardKey,
      verificationStatus,
      // Yenidən göndəriləndə köhnə rədd səbəbini təmizlə.
      ...(verificationStatus === "PENDING" ? { rejectionReason: null } : {}),
      ...(submittedAt !== undefined ? { submittedAt } : {}),
    },
  });

  return NextResponse.json({ student: publicShape(saved) });
}
