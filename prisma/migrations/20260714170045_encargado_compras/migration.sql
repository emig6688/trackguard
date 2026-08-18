-- AlterEnum
ALTER TYPE "Rol" ADD VALUE 'ENCARGADO_COMPRAS';

-- AlterTable
ALTER TABLE "OrdenCompra" ADD COLUMN     "ordenDeTrabajoId" TEXT;

-- CreateIndex
CREATE INDEX "OrdenCompra_ordenDeTrabajoId_idx" ON "OrdenCompra"("ordenDeTrabajoId");

-- AddForeignKey
ALTER TABLE "OrdenCompra" ADD CONSTRAINT "OrdenCompra_ordenDeTrabajoId_fkey" FOREIGN KEY ("ordenDeTrabajoId") REFERENCES "OrdenDeTrabajo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

