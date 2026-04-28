import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import SiteHeader from "@/components/SiteHeader";
import ProfileSidebar from "@/components/ProfileSidebar";
import LogoutButton from "@/components/LogoutButton";

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
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <SiteHeader />

      <div className="mx-auto max-w-6xl px-6 py-8">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {user.name ?? user.email}
            </h1>
            <p className="text-sm text-zinc-400">{user.email}</p>
          </div>
          <LogoutButton />
        </header>

        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          <ProfileSidebar />
          <main className="min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
