import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import SiteHeader from "@/components/SiteHeaderServer";
import ProfileSidebar from "@/components/ProfileSidebar";

export const dynamic = "force-dynamic";

export default async function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/profile");
  // Admin-lər də adi müştərilər kimi profil səhifəsini görür. Admin panelə keçid
  // profil daxilindəki düymə ilədir (bax app/profile/page.tsx). /admin onsuz da
  // server tərəfdə role ilə qorunur.

  const profileIncomplete =
    !user.name?.trim() ||
    !user.phone?.trim() ||
    !user.birthDate ||
    !user.gender;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_50%_-10%,rgba(124,58,237,0.08),transparent_34%),linear-gradient(180deg,rgba(247,246,251,0.55),rgba(247,246,251,0.96))] text-zinc-900 dark:bg-[radial-gradient(circle_at_50%_-10%,rgba(88,28,135,0.16),transparent_34%),linear-gradient(180deg,rgba(4,5,14,0.25),rgba(4,5,14,0.9))] dark:text-zinc-100">
      <SiteHeader />

      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
        <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
          <Suspense fallback={<div className="hidden min-h-[200px] w-[260px] lg:block" />}>
            <ProfileSidebar profileIncomplete={profileIncomplete} />
          </Suspense>
          <main className="min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
