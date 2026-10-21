import HbomaxAdminClient from "./HbomaxAdminClient";

export const dynamic = "force-dynamic";

export default function AdminHbomaxPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">HBO Max Kollektor</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Azərbaycan kataloqu: metadata sync, AZ player-də dil validasiyası və vitrinə proyeksiya. Video yüklənmir, giriş
          məlumatı saxlanılmır.
        </p>
      </div>
      <HbomaxAdminClient />
    </div>
  );
}
