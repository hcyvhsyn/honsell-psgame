import SubscriptionPackagesClient from "./SubscriptionPackagesClient";

export const dynamic = "force-dynamic";

export default function AdminSubscriptionPackagesPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Abunəlik Paketləri (Vitrin)</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Ana səhifədəki «Abunəlik paketləri» bölməsində görünən məhsullar. İstədiyini
          vitrindən gizlədə (məhsul öz səhifəsində satışda qalır) və ya tamamilə silə bilərsən.
        </p>
      </div>
      <SubscriptionPackagesClient />
    </div>
  );
}
