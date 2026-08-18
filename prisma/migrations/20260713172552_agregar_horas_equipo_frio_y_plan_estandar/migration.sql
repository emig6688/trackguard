-- AlterEnum
ALTER TYPE "TipoIntervaloPlan" ADD VALUE 'HORAS';

-- AlterTable
ALTER TABLE "PlanMantenimiento" ADD COLUMN     "categoria" TEXT,
ADD COLUMN     "horasUltimoService" INTEGER,
ADD COLUMN     "intervaloHoras" INTEGER;

-- AlterTable
ALTER TABLE "Vehiculo" ADD COLUMN     "horasEquipoFrio" INTEGER;
