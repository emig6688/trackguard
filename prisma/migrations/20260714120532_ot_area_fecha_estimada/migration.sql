-- CreateEnum
CREATE TYPE "AreaReparacionOT" AS ENUM ('FRENOS', 'SUSPENSION', 'ESTRUCTURA', 'MOTOR', 'ELECTRICO', 'NEUMATICOS', 'OTRO');

-- AlterTable
ALTER TABLE "OrdenDeTrabajo" ADD COLUMN     "areaReparacion" "AreaReparacionOT",
ADD COLUMN     "fechaEstimadaFinalizacion" TIMESTAMP(3);

