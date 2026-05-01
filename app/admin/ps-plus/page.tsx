import PsPlusAdminClient from "./PsPlusAdminClient";

export const dynamic = "force-dynamic";

export default function AdminPsPlusPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">PS Plus Paketləri</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Essential, Extra və Deluxe abunəliklərinin qiymətlərini idarə edin. Gözləyən sifarişləri burada icra edin.
        </p>
      </div>
      <PsPlusAdminClient />
    </div>
  );
}
