import EaPlayAdminClient from "./EaPlayAdminClient";

export const dynamic = "force-dynamic";

export default function AdminEaPlayPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">EA Play Paketləri</h1>
        <p className="mt-1 text-sm text-zinc-400">
          EA Play 1 və 12 aylıq abunəliklərinin qiymətlərini idarə edin. Gözləyən sifarişləri burada icra edin.
        </p>
      </div>
      <EaPlayAdminClient />
    </div>
  );
}
