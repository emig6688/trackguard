-- CreateEnum
CREATE TYPE "OrigenCompra" AS ENUM ('STOCK_MINIMO', 'MANUAL');

-- CreateEnum
CREATE TYPE "EstadoCompra" AS ENUM ('PENDIENTE', 'REALIZADA', 'CANCELADA');

-- AlterTable
ALTER TABLE "OTRepuesto" ADD COLUMN     "articuloPanolId" TEXT;

-- AlterTable
ALTER TABLE "OrdenDeTrabajo" ADD COLUMN     "fotoReparacionId" TEXT;

-- CreateTable
CREATE TABLE "ArticuloPanol" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "unidadMedida" TEXT,
    "stockActual" INTEGER NOT NULL DEFAULT 0,
    "stockMinimo" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArticuloPanol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrdenCompra" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "origen" "OrigenCompra" NOT NULL,
    "articuloPanolId" TEXT,
    "descripcion" TEXT NOT NULL,
    "cantidadSolicitada" INTEGER,
    "estado" "EstadoCompra" NOT NULL DEFAULT 'PENDIENTE',
    "creadoPorId" TEXT,
    "fechaSolicitud" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cantidadRecibida" INTEGER,
    "montoTotal" DECIMAL(12,2),
    "fechaCompra" TIMESTAMP(3),
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrdenCompra_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArticuloPanol_activo_idx" ON "ArticuloPanol"("activo");

-- CreateIndex
CREATE UNIQUE INDEX "OrdenCompra_numero_key" ON "OrdenCompra"("numero");

-- CreateIndex
CREATE INDEX "OrdenCompra_estado_idx" ON "OrdenCompra"("estado");

-- AddForeignKey
ALTER TABLE "OrdenDeTrabajo" ADD CONSTRAINT "OrdenDeTrabajo_fotoReparacionId_fkey" FOREIGN KEY ("fotoReparacionId") REFERENCES "Archivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OTRepuesto" ADD CONSTRAINT "OTRepuesto_articuloPanolId_fkey" FOREIGN KEY ("articuloPanolId") REFERENCES "ArticuloPanol"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenCompra" ADD CONSTRAINT "OrdenCompra_articuloPanolId_fkey" FOREIGN KEY ("articuloPanolId") REFERENCES "ArticuloPanol"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenCompra" ADD CONSTRAINT "OrdenCompra_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

