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
    <div className="min-h-screen bg-[radial-gradient(circle_at_50%_-10%,rgba(88,28,135,0.16),transparent_34%),linear-gradient(180deg,rgba(4,5,14,0.25),rgba(4,5,14,0.9))] text-zinc-100">
      <SiteHeader />

      <div className="mx-auto max-w-[1536px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
          <Suspense fallback={<div className="hidden min-h-[200px] w-[260px] lg:block" />}>
            <ProfileSidebar />
          </Suspense>
          <main className="min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
