/**
 * Tələbə (StudentProfile) — client + server arasında paylaşılan saf sabitlər.
 * Burada prisma/pg kimi server-only importlar OLMAMALIDIR ki, client komponent
 * (StudentProfileForm) təhlükəsiz import edə bilsin. (Bax: [[client-import-prisma-build-trap]])
 */

// ─── Kurs ("Neçənci kursda oxuyursan?") ────────────────────────────────────────
export const STUDENT_COURSE_OPTIONS = [
  { value: "1", label: "1-ci kurs" },
  { value: "2", label: "2-ci kurs" },
  { value: "3", label: "3-cü kurs" },
  { value: "4", label: "4-cü kurs" },
  { value: "5", label: "5-ci kurs" },
  { value: "6", label: "6-cı kurs" },
  { value: "MASTERS", label: "Magistratura" },
  { value: "DOCTORATE", label: "Doktorantura" },
] as const;

export type StudentCourse = (typeof STUDENT_COURSE_OPTIONS)[number]["value"];

const COURSE_VALUES = new Set<string>(STUDENT_COURSE_OPTIONS.map((o) => o.value));

/** İcazə verilən kurs dəyəridirsə onu, deyilsə null qaytarır. */
export function normalizeStudentCourse(raw: unknown): StudentCourse | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  // Rəqəm kursları olduğu kimi, mətn dəyərləri (MASTERS/DOCTORATE) böyük hərflə.
  const v = /^[0-9]+$/.test(t) ? t : t.toUpperCase();
  return COURSE_VALUES.has(v) ? (v as StudentCourse) : null;
}

export function studentCourseLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return STUDENT_COURSE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

// ─── Təsdiq statusu ─────────────────────────────────────────────────────────────
export const STUDENT_VERIFICATION_STATUSES = [
  "NOT_SUBMITTED",
  "PENDING",
  "VERIFIED",
  "REJECTED",
] as const;

export type StudentVerificationStatus =
  (typeof STUDENT_VERIFICATION_STATUSES)[number];

export function isStudentVerificationStatus(
  v: unknown,
): v is StudentVerificationStatus {
  return (
    typeof v === "string" &&
    (STUDENT_VERIFICATION_STATUSES as readonly string[]).includes(v)
  );
}

/** Profil səhifəsində istifadəçiyə göstərilən statuslar (etiket + izah). */
export const STUDENT_STATUS_DISPLAY: Record<
  StudentVerificationStatus,
  { label: string; description: string; tone: "neutral" | "pending" | "success" | "error" }
> = {
  NOT_SUBMITTED: {
    label: "Göndərilməyib",
    description:
      "Tələbə məlumatlarını doldurub yadda saxladıqdan sonra yoxlamaya göndəriləcək.",
    tone: "neutral",
  },
  PENDING: {
    label: "Yoxlanılır",
    description: "Tələbə məlumatların admin tərəfindən yoxlanılır.",
    tone: "pending",
  },
  VERIFIED: {
    label: "Təsdiqləndi",
    description: "Tələbə statusun təsdiqləndi.",
    tone: "success",
  },
  REJECTED: {
    label: "Təsdiqlənmədi",
    description:
      "Tələbə məlumatların təsdiqlənmədi. Məlumatları yeniləyib yenidən göndərə bilərsən.",
    tone: "error",
  },
};

/** Tələbə kartı üçün qəbul olunan fayl tipləri (client accept + server yoxlaması). */
export const STUDENT_CARD_ACCEPT = "image/jpeg,image/jpg,image/png,image/webp";
