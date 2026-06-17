-- AlterTable: ADD_TO_CART banneri artıq oyunla yanaşı bir xidmət/məhsula da
-- (streaming, platform, PS Plus, EA Play, hədiyyə kartı...) referans verə bilir.
ALTER TABLE "Banner" ADD COLUMN "serviceProductId" TEXT;

-- CreateIndex
CREATE INDEX "Banner_serviceProductId_idx" ON "Banner"("serviceProductId");

-- AddForeignKey
ALTER TABLE "Banner" ADD CONSTRAINT "Banner_serviceProductId_fkey" FOREIGN KEY ("serviceProductId") REFERENCES "ServiceProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
