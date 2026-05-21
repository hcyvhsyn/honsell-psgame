import WebsiteAddOnsAdminClient from "./WebsiteAddOnsAdminClient";

export const dynamic = "force-dynamic";

export default function AdminWebsiteAddOnsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">
          Website Xidməti — Əlavə Funksiyalar
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Müştəri formunda göstərilən əlavə funksiyaları və qiymətlərini idarə
          edin. Hər add-on ya sabit qiymətli (FLAT), ya da vahid başına
          qiymətli (PER_UNIT — məs. dil dəstəyi) ola bilər.
        </p>
      </div>
      <WebsiteAddOnsAdminClient />
    </div>
  );
}
