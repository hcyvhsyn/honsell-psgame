import SearchSuggestionsAdminClient from "./SearchSuggestionsAdminClient";

export const dynamic = "force-dynamic";

export default function AdminSearchSuggestionsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Populyar axtarışlar</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Header axtarış modalında &laquo;Populyar axtarışlar&raquo; altında göstərilən pill-lər.
          Aktiv olanlar `sortOrder`-ə görə sıralanır. Heç nə əlavə edilməsə, default
          siyahı (Spider-Man, PS Plus və s.) göstərilir.
        </p>
      </div>
      <SearchSuggestionsAdminClient />
    </div>
  );
}
