-- Streaming hesab stoku — platformaya görə (aya görə deyil).
CREATE TABLE "StreamingStock" (
    "id" TEXT NOT NULL,
    "platformCode" TEXT NOT NULL,
    "mail" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "cabinetName" TEXT NOT NULL,
    "pinCode" TEXT NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),
    CONSTRAINT "StreamingStock_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StreamingStock_platformCode_isUsed_idx" ON "StreamingStock"("platformCode", "isUsed");
