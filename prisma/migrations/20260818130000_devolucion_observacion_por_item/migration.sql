-- AlterTable
ALTER TABLE "CambioDevolucion" ADD COLUMN     "observacion" TEXT;

-- AlterTable
ALTER TABLE "Devolucion" DROP COLUMN "observaciones";

-- AlterTable
ALTER TABLE "ProductoDevuelto" ADD COLUMN     "observacion" TEXT;

