-- AlterEnum
ALTER TYPE "EstadoCompra" ADD VALUE 'DOCUMENTADA';

-- AlterTable
ALTER TABLE "OrdenCompra" ADD COLUMN     "facturaArchivoId" TEXT;

-- AddForeignKey
ALTER TABLE "OrdenCompra" ADD CONSTRAINT "OrdenCompra_facturaArchivoId_fkey" FOREIGN KEY ("facturaArchivoId") REFERENCES "Archivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

