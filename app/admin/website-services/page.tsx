import WebsiteServicesAdminClient from "./WebsiteServicesAdminClient";

export const dynamic = "force-dynamic";

export default function AdminWebsiteServicesPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Website Xidməti — Paketlər</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Müştərilərə təklif olunan website hazırlama paketlərini buradan idarə edin.
          Bu paketlər public xidmət səhifəsində göstərilir.
        </p>
      </div>
      <WebsiteServicesAdminClient />
    </div>
  );
}
