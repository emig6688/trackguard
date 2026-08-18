-- CreateEnum
CREATE TYPE "ResultadoItemPreventivo" AS ENUM ('PENDIENTE', 'OK', 'REPARADO');

-- CreateTable
CREATE TABLE "OTItemPreventivo" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "ordenDeTrabajoId" TEXT NOT NULL,
    "planMantenimientoId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "categoria" TEXT,
    "resultado" "ResultadoItemPreventivo" NOT NULL DEFAULT 'PENDIENTE',
    "observacion" TEXT,
    "archivoId" TEXT,
    "completadoEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OTItemPreventivo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OTItemPreventivo_ordenDeTrabajoId_idx" ON "OTItemPreventivo"("ordenDeTrabajoId");

-- CreateIndex
CREATE INDEX "OTItemPreventivo_empresaId_idx" ON "OTItemPreventivo"("empresaId");

-- AddForeignKey
ALTER TABLE "OTItemPreventivo" ADD CONSTRAINT "OTItemPreventivo_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OTItemPreventivo" ADD CONSTRAINT "OTItemPreventivo_ordenDeTrabajoId_fkey" FOREIGN KEY ("ordenDeTrabajoId") REFERENCES "OrdenDeTrabajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OTItemPreventivo" ADD CONSTRAINT "OTItemPreventivo_planMantenimientoId_fkey" FOREIGN KEY ("planMantenimientoId") REFERENCES "PlanMantenimiento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OTItemPreventivo" ADD CONSTRAINT "OTItemPreventivo_archivoId_fkey" FOREIGN KEY ("archivoId") REFERENCES "Archivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

