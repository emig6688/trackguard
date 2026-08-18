
-- AlterTable
ALTER TABLE "OrdenCompra" ADD COLUMN     "otItemPreventivoId" TEXT;

-- CreateIndex
CREATE INDEX "OrdenCompra_otItemPreventivoId_idx" ON "OrdenCompra"("otItemPreventivoId");

-- AddForeignKey
ALTER TABLE "OrdenCompra" ADD CONSTRAINT "OrdenCompra_otItemPreventivoId_fkey" FOREIGN KEY ("otItemPreventivoId") REFERENCES "OTItemPreventivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

