import { UserRound, AlertTriangle } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
  if (!user.birthDate) missing.push("Doğum tarixi");
  if (!user.gender) missing.push("Cinsiyət");

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
      <header className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-500/12 text-indigo-700 ring-1 ring-indigo-300/70 dark:bg-indigo-500/15 dark:text-indigo-300 dark:ring-indigo-500/40">
          <UserRound className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold">Hesab məlumatları</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Şəxsi məlumatlarını burada redaktə et.
          </p>
        </div>
      </header>

      {missing.length > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-300/80 bg-rose-50/95 p-4 text-sm shadow-[0_18px_44px_-34px_rgba(244,63,94,0.4)] dark:border-rose-500/40 dark:bg-rose-500/10 dark:shadow-none">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-rose-100 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/20 dark:text-rose-200 dark:ring-rose-400/40">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div className="space-y-1">
            <p className="font-bold text-rose-800 dark:text-rose-100">
              Profil məlumatlarını tamamla
            </p>
            <p className="text-rose-700/90 dark:text-rose-200/80">
              Aşağıdakı sahələr boşdur — daha rahat sifariş və dəstək üçün
              xahiş edirik onları doldurub yadda saxla.
            </p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {missing.map((label) => (
                <li
                  key={label}
                  className="inline-flex items-center gap-1 rounded-full border border-rose-300 bg-rose-100 px-2.5 py-1 text-[11px] font-semibold text-rose-700 dark:border-rose-400/30 dark:bg-rose-500/15 dark:text-rose-100"
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
          email: user.email,
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
