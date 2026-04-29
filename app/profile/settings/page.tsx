import { UserRound } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import ProfileSettingsForm from "@/components/ProfileSettingsForm";

export const dynamic = "force-dynamic";

export default async function ProfileSettingsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

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
