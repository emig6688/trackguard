-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoNotificacion" ADD VALUE 'DEVOLUCION_ENVIADA';
ALTER TYPE "TipoNotificacion" ADD VALUE 'DEVOLUCION_SIN_ENVIAR';

-- AlterTable
ALTER TABLE "Devolucion" ADD COLUMN     "enviadoEn" TIMESTAMP(3),
ADD COLUMN     "enviadoPorId" TEXT;

-- AddForeignKey
ALTER TABLE "Devolucion" ADD CONSTRAINT "Devolucion_enviadoPorId_fkey" FOREIGN KEY ("enviadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

