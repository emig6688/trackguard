-- CreateTable
CREATE TABLE "DiaNoOperado" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "vehiculoId" TEXT NOT NULL,
    "choferId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "motivo" TEXT,
    "marcadoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiaNoOperado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DiaNoOperado_empresaId_vehiculoId_fecha_key" ON "DiaNoOperado"("empresaId", "vehiculoId", "fecha");

-- CreateIndex
CREATE INDEX "DiaNoOperado_empresaId_idx" ON "DiaNoOperado"("empresaId");

-- CreateIndex
CREATE INDEX "DiaNoOperado_choferId_fecha_idx" ON "DiaNoOperado"("choferId", "fecha");

-- AddForeignKey
ALTER TABLE "DiaNoOperado" ADD CONSTRAINT "DiaNoOperado_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiaNoOperado" ADD CONSTRAINT "DiaNoOperado_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiaNoOperado" ADD CONSTRAINT "DiaNoOperado_choferId_fkey" FOREIGN KEY ("choferId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiaNoOperado" ADD CONSTRAINT "DiaNoOperado_marcadoPorId_fkey" FOREIGN KEY ("marcadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
