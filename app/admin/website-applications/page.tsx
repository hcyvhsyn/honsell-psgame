import WebsiteApplicationsAdminClient from "./WebsiteApplicationsAdminClient";

export const dynamic = "force-dynamic";

export default function AdminWebsiteApplicationsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Website Xidməti — Müraciətlər</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Müştərilərdən gələn website layihə müraciətlərinə baxın və status-u yeniləyin.
        </p>
      </div>
      <WebsiteApplicationsAdminClient />
    </div>
  );
}
