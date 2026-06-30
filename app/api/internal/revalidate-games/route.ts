import { revalidateGames } from "@/lib/revalidate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * On-demand oyun keş invalidasiyası.
 *
 * `revalidateTag`/`revalidatePath` yalnız canlı request/render konteksti
 * içində işləyir. PS-store scrape-i (app/api/scrape-ps-store) bütün DB işini
 * request scope-undan sonra yaşamağa davam edən detached `ReadableStream`
 * içində görür — ona görə də orada `revalidateGames()` çağırışı səssizcə
 * no-op olur (Next storage konteksti artıq bağlanıb). Nəticədə bitmiş
 * endirimlər kataloq/ana səhifə kartlarında TTL bitənə qədər (ana səhifə üçün
 * 30 dəq) qalır.
 *
 * Bu route scrape-ə (və ya istənilən arxa-fon işinə) HTTP üzərindən gerçək keş
 * təmizləməsi tetiklemek imkanı verir: handler normal request kontekstində
 * işlədiyi üçün revalidasiya etibarlı şəkildə tətbiq olunur.
 *
 * Auth: cron route-larındakı kimi paylaşılan `CRON_SECRET` (Bearer). Secret
 * təyin olunmayıbsa yoxlama atlanılır (cron route-larıyla eyni davranış).
 */
export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const expected = process.env.CRON_SECRET;
  if (expected && auth !== `Bearer ${expected}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  revalidateGames();
  return Response.json({ revalidated: true });
}
