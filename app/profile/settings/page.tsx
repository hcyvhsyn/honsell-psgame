import { UserRound, AlertTriangle } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import ProfileSettingsForm from "@/components/ProfileSettingsForm";

export const dynamic = "force-dynamic";

export default async function ProfileSettingsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const missing: string[] = [];
  if (!user.name?.trim()) missing.push("Ad Soyad");
  if (!user.phone?.trim()) missing.push("Telefon nömrəsi");
  if (!user.birthDate) missing.push("Doğum tarixi");
  if (!user.gender) missing.push("Cinsiyət");

  return (
    <section className="space-y-5">
      <header className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-500/40">
          <UserRound className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold">Hesab məlumatları</h2>
          <p className="text-sm text-zinc-400">
            Şəxsi məlumatlarını burada redaktə et.
          </p>
        </div>
      </header>

      {missing.length > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-rose-500/20 text-rose-200 ring-1 ring-rose-400/40">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div className="space-y-1">
            <p className="font-bold text-rose-100">
              Profil məlumatlarını tamamla
            </p>
            <p className="text-rose-200/80">
              Aşağıdakı sahələr boşdur — daha rahat sifariş və dəstək üçün
              xahiş edirik onları doldurub yadda saxla.
            </p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {missing.map((label) => (
                <li
                  key={label}
                  className="inline-flex items-center gap-1 rounded-full border border-rose-400/30 bg-rose-500/15 px-2.5 py-1 text-[11px] font-semibold text-rose-100"
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
    </section>
  );
}
