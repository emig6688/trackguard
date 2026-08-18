
-- AlterTable
ALTER TABLE "OTRepuesto" ADD COLUMN     "otItemPreventivoId" TEXT;

-- CreateIndex
CREATE INDEX "OTRepuesto_otItemPreventivoId_idx" ON "OTRepuesto"("otItemPreventivoId");

-- AddForeignKey
ALTER TABLE "OTRepuesto" ADD CONSTRAINT "OTRepuesto_otItemPreventivoId_fkey" FOREIGN KEY ("otItemPreventivoId") REFERENCES "OTItemPreventivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

