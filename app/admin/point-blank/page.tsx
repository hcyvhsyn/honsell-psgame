import PointBlankAdminClient from "@/components/admin/PointBlankAdminClient";

export const dynamic = "force-dynamic";

export default function AdminPointBlankPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Point Blank TG</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Hər TG paketinin qiymətini, şəklini və e-pin kod stokunu idarə edin. Müştəri alanda
          stokdan kod avtomatik təhvil verilir; stok bitəndə sifariş “Sifarişlər” bölməsində
          əl ilə təhvil üçün görünür.
        </p>
      </div>
      <PointBlankAdminClient />
    </div>
  );
}
