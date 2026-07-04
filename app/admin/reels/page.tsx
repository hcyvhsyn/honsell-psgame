import ReelsAdminClient from "./ReelsAdminClient";

export const dynamic = "force-dynamic";

export default function AdminReelsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Reels (Videolar)</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Şaquli videolar yüklə — istifadəçi <b>/reels</b> feed-ində izləyir, bəyənir,
          şərh yazır və tək toxunuşla CTA hədəfini (oyun / hesab xidməti / xarici
          link) açır. Ən yaxşı nəticə üçün video 9:16, MP4 (H.264, <b>faststart</b>) olsun.
        </p>
      </div>
      <ReelsAdminClient />
    </div>
  );
}
