-- AlterEnum
ALTER TYPE "Rol" ADD VALUE 'SUPERADMIN';

-- CreateTable
CREATE TABLE "Empresa" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Empresa_pkey" PRIMARY KEY ("id")
);

-- Empresa por defecto: todos los datos existentes (single-tenant hasta ahora)
-- quedan asignados acá antes de que empresaId se vuelva obligatorio.
INSERT INTO "Empresa" ("id", "nombre", "activo", "createdAt", "updatedAt")
VALUES ('cmrkyqbgvj1labz7ylozfj5cg', 'MEAT S.A.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- AlterTable: agregar empresaId nullable primero (se completa con el backfill
-- de abajo antes de exigir NOT NULL, salvo en Usuario que queda nullable a
-- propósito para permitir un SUPERADMIN sin empresa).
ALTER TABLE "Archivo" ADD COLUMN     "empresaId" TEXT;
ALTER TABLE "ArticuloPanol" ADD COLUMN     "empresaId" TEXT;
ALTER TABLE "CargaCombustible" ADD COLUMN     "empresaId" TEXT;
ALTER TABLE "ChecklistTemplate" ADD COLUMN     "empresaId" TEXT;
ALTER TABLE "Documento" ADD COLUMN     "empresaId" TEXT;
ALTER TABLE "EventoRuta" ADD COLUMN     "empresaId" TEXT;
ALTER TABLE "Factura" ADD COLUMN     "empresaId" TEXT;
ALTER TABLE "Gasto" ADD COLUMN     "empresaId" TEXT;
ALTER TABLE "OTRepuesto" ADD COLUMN     "empresaId" TEXT;
ALTER TABLE "OrdenCompra" ADD COLUMN     "empresaId" TEXT;
ALTER TABLE "OrdenDeTrabajo" ADD COLUMN     "empresaId" TEXT;
ALTER TABLE "PlanMantenimiento" ADD COLUMN     "empresaId" TEXT;
ALTER TABLE "TallerExterno" ADD COLUMN     "empresaId" TEXT;
ALTER TABLE "TipoDocumentoConfig" ADD COLUMN     "empresaId" TEXT;
ALTER TABLE "Usuario" ADD COLUMN     "empresaId" TEXT;
ALTER TABLE "Vehiculo" ADD COLUMN     "empresaId" TEXT;

-- Backfill: todo lo existente pasa a pertenecer a la empresa por defecto.
UPDATE "Archivo" SET "empresaId" = 'cmrkyqbgvj1labz7ylozfj5cg';
UPDATE "ArticuloPanol" SET "empresaId" = 'cmrkyqbgvj1labz7ylozfj5cg';
UPDATE "CargaCombustible" SET "empresaId" = 'cmrkyqbgvj1labz7ylozfj5cg';
UPDATE "ChecklistTemplate" SET "empresaId" = 'cmrkyqbgvj1labz7ylozfj5cg';
UPDATE "Documento" SET "empresaId" = 'cmrkyqbgvj1labz7ylozfj5cg';
UPDATE "EventoRuta" SET "empresaId" = 'cmrkyqbgvj1labz7ylozfj5cg';
UPDATE "Factura" SET "empresaId" = 'cmrkyqbgvj1labz7ylozfj5cg';
UPDATE "Gasto" SET "empresaId" = 'cmrkyqbgvj1labz7ylozfj5cg';
UPDATE "OTRepuesto" SET "empresaId" = 'cmrkyqbgvj1labz7ylozfj5cg';
UPDATE "OrdenCompra" SET "empresaId" = 'cmrkyqbgvj1labz7ylozfj5cg';
UPDATE "OrdenDeTrabajo" SET "empresaId" = 'cmrkyqbgvj1labz7ylozfj5cg';
UPDATE "PlanMantenimiento" SET "empresaId" = 'cmrkyqbgvj1labz7ylozfj5cg';
UPDATE "TallerExterno" SET "empresaId" = 'cmrkyqbgvj1labz7ylozfj5cg';
UPDATE "TipoDocumentoConfig" SET "empresaId" = 'cmrkyqbgvj1labz7ylozfj5cg';
UPDATE "Usuario" SET "empresaId" = 'cmrkyqbgvj1labz7ylozfj5cg';
UPDATE "Vehiculo" SET "empresaId" = 'cmrkyqbgvj1labz7ylozfj5cg';

-- AlterTable: ahora sí, obligatorio en todo salvo Usuario (SUPERADMIN no
-- pertenece a ninguna empresa).
ALTER TABLE "Archivo" ALTER COLUMN "empresaId" SET NOT NULL;
ALTER TABLE "ArticuloPanol" ALTER COLUMN "empresaId" SET NOT NULL;
ALTER TABLE "CargaCombustible" ALTER COLUMN "empresaId" SET NOT NULL;
ALTER TABLE "ChecklistTemplate" ALTER COLUMN "empresaId" SET NOT NULL;
ALTER TABLE "Documento" ALTER COLUMN "empresaId" SET NOT NULL;
ALTER TABLE "EventoRuta" ALTER COLUMN "empresaId" SET NOT NULL;
ALTER TABLE "Factura" ALTER COLUMN "empresaId" SET NOT NULL;
ALTER TABLE "Gasto" ALTER COLUMN "empresaId" SET NOT NULL;
ALTER TABLE "OTRepuesto" ALTER COLUMN "empresaId" SET NOT NULL;
ALTER TABLE "OrdenCompra" ALTER COLUMN "empresaId" SET NOT NULL;
ALTER TABLE "OrdenDeTrabajo" ALTER COLUMN "empresaId" SET NOT NULL;
ALTER TABLE "PlanMantenimiento" ALTER COLUMN "empresaId" SET NOT NULL;
ALTER TABLE "TallerExterno" ALTER COLUMN "empresaId" SET NOT NULL;
ALTER TABLE "TipoDocumentoConfig" ALTER COLUMN "empresaId" SET NOT NULL;
ALTER TABLE "Vehiculo" ALTER COLUMN "empresaId" SET NOT NULL;

-- DropIndex: las constraints unicas globales de numero/codigo pasan a ser
-- compuestas por empresa (dos empresas van a repetir numeración/códigos).
DROP INDEX "OrdenCompra_numero_key";
DROP INDEX "OrdenDeTrabajo_numero_key";
DROP INDEX "TipoDocumentoConfig_codigo_key";

-- CreateIndex
CREATE INDEX "Archivo_empresaId_idx" ON "Archivo"("empresaId");
CREATE INDEX "ArticuloPanol_empresaId_idx" ON "ArticuloPanol"("empresaId");
CREATE INDEX "CargaCombustible_empresaId_idx" ON "CargaCombustible"("empresaId");
CREATE INDEX "ChecklistTemplate_empresaId_idx" ON "ChecklistTemplate"("empresaId");
CREATE INDEX "Documento_empresaId_idx" ON "Documento"("empresaId");
CREATE INDEX "EventoRuta_empresaId_idx" ON "EventoRuta"("empresaId");
CREATE INDEX "Factura_empresaId_idx" ON "Factura"("empresaId");
CREATE INDEX "Gasto_empresaId_idx" ON "Gasto"("empresaId");
CREATE INDEX "OTRepuesto_empresaId_idx" ON "OTRepuesto"("empresaId");
CREATE INDEX "OrdenCompra_empresaId_idx" ON "OrdenCompra"("empresaId");
CREATE UNIQUE INDEX "OrdenCompra_empresaId_numero_key" ON "OrdenCompra"("empresaId", "numero");
CREATE INDEX "OrdenDeTrabajo_empresaId_idx" ON "OrdenDeTrabajo"("empresaId");
CREATE UNIQUE INDEX "OrdenDeTrabajo_empresaId_numero_key" ON "OrdenDeTrabajo"("empresaId", "numero");
CREATE INDEX "PlanMantenimiento_empresaId_idx" ON "PlanMantenimiento"("empresaId");
CREATE INDEX "TallerExterno_empresaId_idx" ON "TallerExterno"("empresaId");
CREATE UNIQUE INDEX "TipoDocumentoConfig_empresaId_codigo_key" ON "TipoDocumentoConfig"("empresaId", "codigo");
CREATE INDEX "Usuario_empresaId_idx" ON "Usuario"("empresaId");
CREATE INDEX "Vehiculo_empresaId_idx" ON "Vehiculo"("empresaId");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Vehiculo" ADD CONSTRAINT "Vehiculo_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TipoDocumentoConfig" ADD CONSTRAINT "TipoDocumentoConfig_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlanMantenimiento" ADD CONSTRAINT "PlanMantenimiento_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TallerExterno" ADD CONSTRAINT "TallerExterno_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrdenDeTrabajo" ADD CONSTRAINT "OrdenDeTrabajo_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OTRepuesto" ADD CONSTRAINT "OTRepuesto_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Factura" ADD CONSTRAINT "Factura_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ArticuloPanol" ADD CONSTRAINT "ArticuloPanol_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrdenCompra" ADD CONSTRAINT "OrdenCompra_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChecklistTemplate" ADD CONSTRAINT "ChecklistTemplate_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventoRuta" ADD CONSTRAINT "EventoRuta_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CargaCombustible" ADD CONSTRAINT "CargaCombustible_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Archivo" ADD CONSTRAINT "Archivo_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
