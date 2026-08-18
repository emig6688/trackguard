-- CreateEnum
CREATE TYPE "EstadoAutorizacionCompra" AS ENUM ('NO_REQUERIDA', 'PENDIENTE', 'APROBADA', 'RECHAZADA');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoNotificacion" ADD VALUE 'COMPRA_PENDIENTE_AUTORIZACION';
ALTER TYPE "TipoNotificacion" ADD VALUE 'PRESUPUESTO_SUBIDO';

-- AlterTable
ALTER TABLE "Empresa" ADD COLUMN     "montoAutorizacionCompra" DECIMAL(12,2);

-- AlterTable: agregar columnas nuevas antes de tocar las viejas.
ALTER TABLE "OrdenCompra" ADD COLUMN     "montoEstimado" DECIMAL(12,2),
ADD COLUMN     "estadoAutorizacion" "EstadoAutorizacionCompra" NOT NULL DEFAULT 'NO_REQUERIDA',
ADD COLUMN     "autorizadoPorId" TEXT,
ADD COLUMN     "autorizadoEn" TIMESTAMP(3),
ADD COLUMN     "presupuestoAprobadoId" TEXT;

-- CreateTable
CREATE TABLE "OrdenCompraItem" (
    "id" TEXT NOT NULL,
    "ordenCompraId" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "cantidadSolicitada" INTEGER,
    "cantidadRecibida" INTEGER,
    "articuloPanolId" TEXT,
    "archivoId" TEXT,

    CONSTRAINT "OrdenCompraItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PresupuestoCompra" (
    "id" TEXT NOT NULL,
    "ordenCompraId" TEXT NOT NULL,
    "archivoId" TEXT NOT NULL,
    "monto" DECIMAL(12,2),
    "proveedor" TEXT,
    "subidoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PresupuestoCompra_pkey" PRIMARY KEY ("id")
);

-- Backfill: una OrdenCompraItem por cada OrdenCompra existente, copiando sus
-- campos de ítem único antes de eliminarlos de la cabecera. Se hace antes del
-- DROP COLUMN de más abajo para no perder datos reales.
INSERT INTO "OrdenCompraItem" ("id", "ordenCompraId", "descripcion", "cantidadSolicitada", "cantidadRecibida", "articuloPanolId")
SELECT gen_random_uuid()::text, "id", "descripcion", "cantidadSolicitada", "cantidadRecibida", "articuloPanolId"
FROM "OrdenCompra";

-- DropForeignKey: FK vieja de OrdenCompra directo a ArticuloPanol (ahora vive en OrdenCompraItem).
ALTER TABLE "OrdenCompra" DROP CONSTRAINT "OrdenCompra_articuloPanolId_fkey";

-- AlterTable: recién ahora se eliminan las columnas de ítem único de la cabecera.
ALTER TABLE "OrdenCompra" DROP COLUMN "descripcion",
DROP COLUMN "cantidadSolicitada",
DROP COLUMN "cantidadRecibida",
DROP COLUMN "articuloPanolId";

-- CreateIndex
CREATE INDEX "OrdenCompraItem_ordenCompraId_idx" ON "OrdenCompraItem"("ordenCompraId");

-- CreateIndex
CREATE INDEX "OrdenCompraItem_articuloPanolId_idx" ON "OrdenCompraItem"("articuloPanolId");

-- CreateIndex
CREATE INDEX "PresupuestoCompra_ordenCompraId_idx" ON "PresupuestoCompra"("ordenCompraId");

-- CreateIndex
CREATE UNIQUE INDEX "OrdenCompra_presupuestoAprobadoId_key" ON "OrdenCompra"("presupuestoAprobadoId");

-- CreateIndex
CREATE INDEX "OrdenCompra_estadoAutorizacion_idx" ON "OrdenCompra"("estadoAutorizacion");

-- AddForeignKey
ALTER TABLE "OrdenCompra" ADD CONSTRAINT "OrdenCompra_autorizadoPorId_fkey" FOREIGN KEY ("autorizadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenCompra" ADD CONSTRAINT "OrdenCompra_presupuestoAprobadoId_fkey" FOREIGN KEY ("presupuestoAprobadoId") REFERENCES "PresupuestoCompra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenCompraItem" ADD CONSTRAINT "OrdenCompraItem_ordenCompraId_fkey" FOREIGN KEY ("ordenCompraId") REFERENCES "OrdenCompra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenCompraItem" ADD CONSTRAINT "OrdenCompraItem_articuloPanolId_fkey" FOREIGN KEY ("articuloPanolId") REFERENCES "ArticuloPanol"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenCompraItem" ADD CONSTRAINT "OrdenCompraItem_archivoId_fkey" FOREIGN KEY ("archivoId") REFERENCES "Archivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresupuestoCompra" ADD CONSTRAINT "PresupuestoCompra_ordenCompraId_fkey" FOREIGN KEY ("ordenCompraId") REFERENCES "OrdenCompra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresupuestoCompra" ADD CONSTRAINT "PresupuestoCompra_archivoId_fkey" FOREIGN KEY ("archivoId") REFERENCES "Archivo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresupuestoCompra" ADD CONSTRAINT "PresupuestoCompra_subidoPorId_fkey" FOREIGN KEY ("subidoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
