-- PS Store concept id → SKU keşi.
-- Hub səhifələri oyunları concept kimi qaytarır (rəqəmli id); kataloqda
-- satıla bilən SKU lazımdır. Bu cədvəl concept→SKU çevirməsini keşləyir ki,
-- hər skreyp run-ı eyni concept səhifələrini yenidən çəkməsin.
--
-- `productTitle` SKU-nun öz adıdır: onsuz ikinci run-da ad yenidən concept
-- qridindən götürülər və "Call of Duty®" / "The Last of Us™ Part II" kimi
-- yanlış başlıqlar geri qayıdardı.
CREATE TABLE "PsStoreConcept" (
    "conceptId" TEXT NOT NULL,
    "productId" TEXT,
    "productTitle" TEXT,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "PsStoreConcept_pkey" PRIMARY KEY ("conceptId")
);

CREATE INDEX "PsStoreConcept_productId_idx" ON "PsStoreConcept"("productId");
CREATE INDEX "PsStoreConcept_attemptedAt_idx" ON "PsStoreConcept"("attemptedAt");
