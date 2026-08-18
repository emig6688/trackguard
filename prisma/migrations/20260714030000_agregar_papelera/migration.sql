-- AlterTable
ALTER TABLE "ArticuloPanol" ADD COLUMN     "eliminadoEn" TIMESTAMP(3),
ADD COLUMN     "eliminadoPorId" TEXT;

-- AlterTable
ALTER TABLE "CargaCombustible" ADD COLUMN     "eliminadoEn" TIMESTAMP(3),
ADD COLUMN     "eliminadoPorId" TEXT;

-- AlterTable
ALTER TABLE "Documento" ADD COLUMN     "eliminadoEn" TIMESTAMP(3),
ADD COLUMN     "eliminadoPorId" TEXT;

-- AlterTable
ALTER TABLE "Factura" ADD COLUMN     "eliminadoEn" TIMESTAMP(3),
ADD COLUMN     "eliminadoPorId" TEXT;

-- AlterTable
ALTER TABLE "Gasto" ADD COLUMN     "eliminadoEn" TIMESTAMP(3),
ADD COLUMN     "eliminadoPorId" TEXT;

-- AlterTable
ALTER TABLE "OTRepuesto" ADD COLUMN     "eliminadoEn" TIMESTAMP(3),
ADD COLUMN     "eliminadoPorId" TEXT;

-- AlterTable
ALTER TABLE "OrdenCompra" ADD COLUMN     "eliminadoEn" TIMESTAMP(3),
ADD COLUMN     "eliminadoPorId" TEXT;

-- AlterTable
ALTER TABLE "OrdenDeTrabajo" ADD COLUMN     "eliminadoEn" TIMESTAMP(3),
ADD COLUMN     "eliminadoPorId" TEXT;

-- AlterTable
ALTER TABLE "PlanMantenimiento" ADD COLUMN     "eliminadoEn" TIMESTAMP(3),
ADD COLUMN     "eliminadoPorId" TEXT;

-- AlterTable
ALTER TABLE "TallerExterno" ADD COLUMN     "eliminadoEn" TIMESTAMP(3),
ADD COLUMN     "eliminadoPorId" TEXT;

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "eliminadoEn" TIMESTAMP(3),
ADD COLUMN     "eliminadoPorId" TEXT;

-- AlterTable
ALTER TABLE "Vehiculo" ADD COLUMN     "eliminadoEn" TIMESTAMP(3),
ADD COLUMN     "eliminadoPorId" TEXT;

