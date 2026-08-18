-- AlterTable
ALTER TABLE "Vehiculo" ADD COLUMN     "disponible" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "disponibleActualizadoEn" TIMESTAMP(3),
ADD COLUMN     "disponibleActualizadoPorId" TEXT;

