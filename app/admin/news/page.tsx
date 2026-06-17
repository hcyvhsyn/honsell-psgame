import NewsAdminClient from "./NewsAdminClient";

export const dynamic = "force-dynamic";

export default function AdminNewsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Xəbərlər</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Hər xəbər bir scope-a bağlanır — PlayStation, Streaming və Music
          səhifələrində uyğun xəbərlər avtomatik göstərilir. &quot;Featured&quot; etiketi
          olan xəbər böyük hero kart formasında render olunur.
        </p>
      </div>
      <NewsAdminClient />
    </div>
  );
}
