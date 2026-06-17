import CategoryAssetsAdminClient from "./CategoryAssetsAdminClient";

export const dynamic = "force-dynamic";

export default function AdminCategoriesPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Kateqoriya şəkilləri</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Navbar dropdown və mobil kateqoriya kartlarında görünən kvadrat şəkilləri idarə edin.
        </p>
      </div>
      <CategoryAssetsAdminClient />
    </div>
  );
}
