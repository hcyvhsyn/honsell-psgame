import ActivationStepsAdminClient from "./ActivationStepsAdminClient";

export const dynamic = "force-dynamic";

export default function AdminActivationStepsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Aktivləşdirmə Addımları</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Public səhifədəki &laquo;Məhsul necə aktivləşdirilir?&raquo; bölməsi. Hər addım
          nömrələnmiş timeline-da göstərilir — başlıq, opsional izah və opsional
          ekran görüntüsü. Sıralama burdakı ardıcıllıqla eynidir.
        </p>
      </div>
      <ActivationStepsAdminClient />
    </div>
  );
}
