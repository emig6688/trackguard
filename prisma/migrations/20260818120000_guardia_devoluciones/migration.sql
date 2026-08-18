-- CreateEnum
CREATE TYPE "EtapaObservacionGuardia" AS ENUM ('SALIDA', 'REGRESO');

-- AlterEnum
ALTER TYPE "Rol" ADD VALUE 'GUARDIA';

-- AlterTable
ALTER TABLE "EventoRuta" ADD COLUMN     "tanqueLleno" BOOLEAN;

-- CreateTable
CREATE TABLE "ObservacionGuardia" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "vehiculoId" TEXT NOT NULL,
    "etapa" "EtapaObservacionGuardia" NOT NULL,
    "fecha" DATE NOT NULL,
    "observacion" TEXT NOT NULL,
    "guardiaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ObservacionGuardia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Devolucion" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "choferId" TEXT NOT NULL,
    "cliente" TEXT NOT NULL,
    "remito" TEXT NOT NULL,
    "observaciones" TEXT,
    "registradoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Devolucion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductoDevuelto" (
    "id" TEXT NOT NULL,
    "devolucionId" TEXT NOT NULL,
    "producto" TEXT NOT NULL,
    "correlativo" TEXT NOT NULL,
    "ubicacionGuardado" TEXT NOT NULL,

    CONSTRAINT "ProductoDevuelto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CambioDevolucion" (
    "id" TEXT NOT NULL,
    "devolucionId" TEXT NOT NULL,
    "clienteEntregado" TEXT NOT NULL,
    "producto" TEXT NOT NULL,
    "correlativo" TEXT NOT NULL,
    "autoriz" TEXT NOT NULL,

    CONSTRAINT "CambioDevolucion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ObservacionGuardia_empresaId_idx" ON "ObservacionGuardia"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "ObservacionGuardia_empresaId_vehiculoId_fecha_etapa_key" ON "ObservacionGuardia"("empresaId", "vehiculoId", "fecha", "etapa");

-- CreateIndex
CREATE INDEX "Devolucion_empresaId_idx" ON "Devolucion"("empresaId");

-- CreateIndex
CREATE INDEX "ProductoDevuelto_devolucionId_idx" ON "ProductoDevuelto"("devolucionId");

-- CreateIndex
CREATE INDEX "CambioDevolucion_devolucionId_idx" ON "CambioDevolucion"("devolucionId");

-- AddForeignKey
ALTER TABLE "ObservacionGuardia" ADD CONSTRAINT "ObservacionGuardia_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObservacionGuardia" ADD CONSTRAINT "ObservacionGuardia_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObservacionGuardia" ADD CONSTRAINT "ObservacionGuardia_guardiaId_fkey" FOREIGN KEY ("guardiaId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Devolucion" ADD CONSTRAINT "Devolucion_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Devolucion" ADD CONSTRAINT "Devolucion_choferId_fkey" FOREIGN KEY ("choferId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Devolucion" ADD CONSTRAINT "Devolucion_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoDevuelto" ADD CONSTRAINT "ProductoDevuelto_devolucionId_fkey" FOREIGN KEY ("devolucionId") REFERENCES "Devolucion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CambioDevolucion" ADD CONSTRAINT "CambioDevolucion_devolucionId_fkey" FOREIGN KEY ("devolucionId") REFERENCES "Devolucion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

