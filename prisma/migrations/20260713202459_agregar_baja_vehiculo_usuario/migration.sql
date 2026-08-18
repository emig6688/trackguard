-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "fechaBaja" TIMESTAMP(3),
ADD COLUMN     "observacionBaja" TEXT;

-- AlterTable
ALTER TABLE "Vehiculo" ADD COLUMN     "fechaBaja" TIMESTAMP(3),
ADD COLUMN     "observacionBaja" TEXT;
