import { AlertTriangle } from "lucide-react";
import ProfilePageHeader from "@/components/profile/ProfilePageHeader";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isCrmPlaceholderEmail } from "@/lib/crmAccountEmail";
import ProfileSettingsForm from "@/components/ProfileSettingsForm";
import StudentProfileForm from "@/components/StudentProfileForm";
import { getStudentCardViewUrl } from "@/lib/imageUploadServer";
import { isStudentVerificationStatus } from "@/lib/studentShared";

export const dynamic = "force-dynamic";

export default async function ProfileSettingsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [student, universities] = await Promise.all([
    prisma.studentProfile.findUnique({ where: { userId: user.id } }),
    prisma.university.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, shortName: true },
    }),
  ]);

  const missing: string[] = [];
  if (!user.name?.trim()) missing.push("Ad Soyad");
  if (!user.phone?.trim()) missing.push("Telefon nömrəsi");
  // Doğum tarixi və cinsiyyət heç bir funksiyada işlənmir — "tamamla" xəbərdarlığına daxil deyil (2026-11).

  // Tələbə sahələri yalnız "Tələbəsən?" aktiv olduqda çatışmazlıq sayılır.
  if (student?.isStudent) {
    if (!student.universityId) missing.push("Universitet");
    if (!student.course) missing.push("Kurs");
    if (!student.studentCardKey) missing.push("Tələbə kartı");
  }

  const cardViewUrl = student?.studentCardKey
    ? await getStudentCardViewUrl(student.studentCardKey)
    : null;

  const verificationStatus = isStudentVerificationStatus(student?.verificationStatus)
    ? student.verificationStatus
    : "NOT_SUBMITTED";

  return (
    <section className="space-y-5">
      <ProfilePageHeader title="Hesab məlumatları" description="Ad, telefon və tələbə məlumatların." />

      {missing.length > 0 && (
        // Xəbərdarlıq, xəta deyil — əvvəl qırmızı "xəta" bloku idi.
        <div className="flex items-start gap-3 rounded-2xl border border-amber-300/80 bg-amber-50 p-4 text-sm dark:border-amber-500/30 dark:bg-amber-500/10">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300" />
          <div className="space-y-1">
            <p className="font-bold text-amber-900 dark:text-amber-100">Bir neçə sahə boşdur</p>
            <p className="text-amber-800/90 dark:text-amber-200/80">
              Sifarişlə bağlı səninlə əlaqə saxlaya bilməyimiz üçün bunları doldur:
            </p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {missing.map((label) => (
                <li
                  key={label}
                  className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/15 dark:text-amber-100"
                >
                  {label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <ProfileSettingsForm
        initial={{
          email: isCrmPlaceholderEmail(user.email) ? "— (WhatsApp nömrəsi ilə hesab)" : user.email,
          name: user.name ?? "",
          phone: user.phone ?? "",
          birthDate: user.birthDate
            ? user.birthDate.toISOString().slice(0, 10)
            : "",
          gender: user.gender ?? "",
          referralCode: user.referralCode,
        }}
      />

      <StudentProfileForm
        universities={universities}
        cardViewUrl={cardViewUrl}
        initial={{
          isStudent: student?.isStudent ?? false,
          universityId: student?.universityId ?? null,
          course: student?.course ?? null,
          hasCard: Boolean(student?.studentCardKey),
          verificationStatus,
          rejectionReason: student?.rejectionReason ?? null,
        }}
      />
    </section>
  );
}
