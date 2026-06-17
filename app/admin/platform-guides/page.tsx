import PlatformGuidesAdminClient from "./PlatformGuidesAdminClient";

export const dynamic = "force-dynamic";

export default function AdminPlatformGuidesPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Faydalı Başlıqlar</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Hər platforma üçün qısa bələdçilər — məsələn &quot;HBO Max-ı necə yükləmək olar?&quot;.
          Hər bələdçi konkret scope-da göstərilir.
        </p>
      </div>
      <PlatformGuidesAdminClient />
    </div>
  );
}
