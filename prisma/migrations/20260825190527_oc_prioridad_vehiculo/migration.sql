-- AlterTable
ALTER TABLE "OrdenCompra" ADD COLUMN     "prioridad" "PrioridadOT",
ADD COLUMN     "vehiculoId" TEXT;

-- CreateIndex
CREATE INDEX "OrdenCompra_vehiculoId_idx" ON "OrdenCompra"("vehiculoId");

-- AddForeignKey
ALTER TABLE "OrdenCompra" ADD CONSTRAINT "OrdenCompra_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
