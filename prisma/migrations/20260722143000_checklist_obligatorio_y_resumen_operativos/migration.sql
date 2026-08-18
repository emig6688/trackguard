-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoNotificacion" ADD VALUE 'CHECKLIST_NO_REALIZADO';
ALTER TYPE "TipoNotificacion" ADD VALUE 'RESUMEN_VEHICULOS_OPERATIVOS';

-- AlterTable
ALTER TABLE "ReglaNotificacion" ADD COLUMN     "horaEnvio" INTEGER;

