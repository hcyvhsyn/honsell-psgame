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
  if (user.role === "ADMIN") redirect("/admin");

  return (
    <div className="min-h-screen bg-transparent text-zinc-100">
      <SiteHeader />

      <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 sm:py-12">
        <div className="grid gap-10 lg:grid-cols-[280px_1fr]">
          <Suspense fallback={<div className="hidden w-[280px] lg:block min-h-[200px]" />}>
            <ProfileSidebar />
          </Suspense>
          <main className="min-w-0 pt-2">{children}</main>
        </div>
      </div>
    </div>
  );
}
