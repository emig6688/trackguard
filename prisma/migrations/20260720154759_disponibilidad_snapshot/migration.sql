-- CreateTable
CREATE TABLE "DisponibilidadSnapshot" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "vehiculoId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "disponible" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DisponibilidadSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DisponibilidadSnapshot_empresaId_fecha_idx" ON "DisponibilidadSnapshot"("empresaId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "DisponibilidadSnapshot_vehiculoId_fecha_key" ON "DisponibilidadSnapshot"("vehiculoId", "fecha");

-- AddForeignKey
ALTER TABLE "DisponibilidadSnapshot" ADD CONSTRAINT "DisponibilidadSnapshot_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisponibilidadSnapshot" ADD CONSTRAINT "DisponibilidadSnapshot_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

