import CollectionsAdminClient from "./CollectionsAdminClient";

export const dynamic = "force-dynamic";

export default function AdminCollectionsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Kolleksiyalar</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Tematik oyun kolleksiyaları yaradın və ana səhifədə nümayiş etdirin (məs: &ldquo;Ən yaxşı RPG&rdquo;, &ldquo;PS5 eksklüzivlər&rdquo;).
        </p>
      </div>
      <CollectionsAdminClient />
    </div>
  );
}
