/**
 * Oyun səhifələri üçün azərbaycanca unikal təsvir generasiyası.
 *
 * NƏ ÜÇÜN LAZIMDIR:
 * Bundan əvvəl hər oyun səhifəsi eyni şablon cümləni daşıyırdı ("… oyununu
 * Azərbaycanda ən sərfəli qiymətə al"). Google minlərlə eyni mətnli səhifəni
 * "thin / duplicate content" sayır və indeksləmir. Hər məhsulun öz mətni
 * olduqda kataloq səhifələri ayrı-ayrı sənəd kimi indekslənə bilir.
 *
 * MƏNBƏ: `descriptionLong` / `descriptionShort` (PS Store, türkcə) +
 * janr/nəşriyyatçı/platforma. Türkcə mətn OLDUĞU KİMİ göstərilmir — həm
 * dublikat kontent riski var (PS Store-da eyni mətn), həm də istifadəçi üçün
 * yad dildir. Model onu azərbaycanca YENİDƏN yazır.
 *
 * XƏRC NƏZARƏTİ: `descriptionAzHash` mənbə mətnin barmaq izidir. Mənbə
 * dəyişməyibsə sətir keçilir, yəni skripti təkrar çalışdırmaq pulsuzdur.
 *
 * İşə salmaq:
 *   npx tsx scripts/generateGameDescriptions.ts --limit 100
 *   npx tsx scripts/generateGameDescriptions.ts --limit 5 --dry-run
 *   npx tsx scripts/generateGameDescriptions.ts --force --product-id UP0006-...
 *
 * OPENAI_API_KEY tələb olunur.
 */

import "dotenv/config";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { getOpenAI, isOpenAIConfigured } from "@/lib/openai";

const MODEL = process.env.GAME_DESC_MODEL || "gpt-4o-mini";

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : null;
}
const DRY_RUN = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");
const LIMIT = Number(arg("limit")) || 100;
const CONCURRENCY = Number(arg("concurrency")) || 3;
const ONLY_PRODUCT_ID = arg("product-id");

type Row = {
  id: string;
  productId: string;
  title: string;
  platform: string | null;
  productType: string;
  genres: string[];
  publisherName: string | null;
  releaseDate: Date | null;
  descriptionShort: string | null;
  descriptionLong: string | null;
  descriptionAzHash: string | null;
};

/**
 * Modelə göndərilən mənbə mətni. Hash məhz bunun üzərindən alınır ki, PS Store
 * təsviri yenilənəndə (yeni sezon, yeni məzmun) mətn avtomatik yenilənsin.
 */
function buildSourceText(g: Row): string {
  const parts = [
    `Başlıq: ${g.title}`,
    g.platform ? `Platforma: ${g.platform}` : null,
    g.genres.length ? `Janr: ${g.genres.join(", ")}` : null,
    g.publisherName ? `Nəşriyyatçı: ${g.publisherName}` : null,
    g.releaseDate ? `Çıxış ili: ${g.releaseDate.getUTCFullYear()}` : null,
    g.descriptionShort ? `Qısa təsvir: ${g.descriptionShort}` : null,
    // Uzun təsvir çox vaxt 3-5 min simvol olur; ilk 1800 simvol modelə oyunun
    // nə olduğunu anlatmağa kifayətdir və token xərcini sabit saxlayır.
    g.descriptionLong ? `Tam təsvir: ${g.descriptionLong.slice(0, 1800)}` : null,
  ].filter(Boolean);
  return parts.join("\n");
}

function hashSource(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

const SYSTEM_PROMPT = `Sən Azərbaycanda PlayStation oyunları satan onlayn mağazanın məhsul kopirayterisən.
Sənə oyun haqqında türkcə mağaza məlumatı verilir. Sən onun əsasında AZƏRBAYCAN DİLİNDƏ orijinal məhsul təsviri yazırsan.

QAYDALAR:
- 100-140 söz. 2 abzas.
- Birinci abzas: oyunun nə olduğu, janrı, oyunçunu nə gözləyir. Konkret detal ver (rejimlər, dünya, mexanika) — ümumi sözlərlə kifayətlənmə.
- İkinci abzas: kimə tövsiyə olunur və hansı platformada oynanır.
- Təmiz azərbaycan dili. Türkcə söz və qrammatika İŞLƏTMƏ ("oyunu", "sürümü", "içerir" kimi).
- Qiymət, endirim, çatdırılma, mağaza adı YAZMA — bunlar səhifədə ayrıca var və dəyişkəndir.
- Verilmiş məlumatda olmayan fakt uydurma. Məlumat azdırsa, qısa yaz.
- Marketinq şüarı yazma ("ən yaxşı", "möhtəşəm imkan"). Təsviri məlumat kimi yaz.
- Başlıq, markdown, siyahı işarəsi qoyma. Yalnız iki abzas düz mətn qaytar.`;

async function generateOne(g: Row, source: string): Promise<string | null> {
  const openai = getOpenAI();
  const res = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.7,
    max_tokens: 400,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: source },
    ],
  });
  const text = res.choices[0]?.message?.content?.trim();
  if (!text) return null;
  // Model bəzən başlıq və ya dırnaq əlavə edir — təmizləyirik.
  return text
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/^#+\s.*\n+/, "")
    .trim();
}

async function selectRows(): Promise<Row[]> {
  const select = {
    id: true,
    productId: true,
    title: true,
    platform: true,
    productType: true,
    genres: true,
    publisherName: true,
    releaseDate: true,
    descriptionShort: true,
    descriptionLong: true,
    descriptionAzHash: true,
  } as const;

  if (ONLY_PRODUCT_ID) {
    const one = await prisma.game.findUnique({
      where: { productId: ONLY_PRODUCT_ID },
      select,
    });
    return one ? [one] : [];
  }

  return prisma.game.findMany({
    where: {
      isActive: true,
      // Mənbə mətni olmayan oyuna yazacaq bir şey yoxdur — əvvəlcə
      // scripts/enrichGameMetadata.ts işləməlidir.
      OR: [{ descriptionLong: { not: null } }, { descriptionShort: { not: null } }],
      ...(FORCE ? {} : { descriptionAz: null }),
    },
    select,
    // Endirimdəki və yeni scrape olunanlar əvvəl — onlar ən çox trafik alan
    // səhifələrdir, ona görə mətnə ilk onlar sahib olmalıdır.
    orderBy: [{ isFeatured: "desc" }, { lastScrapedAt: "desc" }],
    take: LIMIT,
  });
}

async function main() {
  if (!isOpenAIConfigured()) {
    console.error("OPENAI_API_KEY təyin olunmayıb.");
    process.exit(1);
  }

  const rows = await selectRows();
  console.log(
    `Namizəd: ${rows.length}${DRY_RUN ? " (dry-run)" : ""} | model: ${MODEL}`
  );
  if (rows.length === 0) {
    console.log("Mənbə təsviri olan oyun tapılmadı — əvvəlcə enrichGameMetadata.ts çalışdırın.");
    return;
  }

  let written = 0;
  let skipped = 0;
  let failed = 0;
  let cursor = 0;

  async function worker() {
    while (cursor < rows.length) {
      const g = rows[cursor++];
      const source = buildSourceText(g);
      const hash = hashSource(source);

      // Mənbə dəyişməyibsə API-yə pul vermirik.
      if (!FORCE && g.descriptionAzHash === hash) {
        skipped++;
        continue;
      }

      try {
        const text = await generateOne(g, source);
        if (!text) {
          failed++;
          continue;
        }
        if (DRY_RUN) {
          console.log(`\n─── ${g.title} ───\n${text}`);
          written++;
        } else {
          await prisma.game.update({
            where: { id: g.id },
            data: { descriptionAz: text, descriptionAzHash: hash },
          });
          written++;
        }
      } catch (e) {
        failed++;
        console.error(`  XƏTA ${g.productId}:`, (e as Error).message);
      }

      if ((written + failed + skipped) % 20 === 0) {
        console.log(`… yazıldı: ${written}, keçildi: ${skipped}, xəta: ${failed}`);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, rows.length) }, worker)
  );

  console.log(`\nBitdi. Yazıldı: ${written}, keçildi: ${skipped}, xəta: ${failed}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
