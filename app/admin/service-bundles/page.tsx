import ServiceBundlesAdminClient from "./ServiceBundlesAdminClient";

export const dynamic = "force-dynamic";

export default function AdminServiceBundlesPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Xidmət dəstləri</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Bir neçə xidməti sərfəli qiymətə bir dəstdə satın (məs: &ldquo;Netflix + HBO
          Max&rdquo;, &ldquo;Prime Video + Spotify&rdquo;). Müştəri dəsti səbətə tək sətir kimi
          atır, ödənişdən sonra hər xidmət adi sifariş kimi ayrıca çatdırılır — sifarişlər{" "}
          <strong>Sifarişlər</strong> səhifəsində həmişəki yerlərində görünür.
        </p>
      </div>
      <ServiceBundlesAdminClient />
    </div>
  );
}
