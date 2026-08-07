import BundlesAdminClient from "./BundlesAdminClient";

export const dynamic = "force-dynamic";

export default function AdminBundlesPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Oyun paketləri</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Bir neçə oyunu sərfəli qiymətə bir paketdə satın (məs: &ldquo;Assassin&rsquo;s Creed
          səbəti&rdquo;, &ldquo;10 AZN səbəti&rdquo;, &ldquo;4-lü paket&rdquo;). Müştəri paketi
          səbətə tək sətir kimi atır, ödənişdən sonra hər oyun ayrıca çatdırılır.
        </p>
      </div>
      <BundlesAdminClient />
    </div>
  );
}
