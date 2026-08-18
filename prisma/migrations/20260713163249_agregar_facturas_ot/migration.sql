-- CreateTable
CREATE TABLE "Factura" (
    "id" TEXT NOT NULL,
    "ordenDeTrabajoId" TEXT NOT NULL,
    "archivoId" TEXT NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "observaciones" TEXT,
    "cargadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Factura_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Factura_ordenDeTrabajoId_idx" ON "Factura"("ordenDeTrabajoId");

-- AddForeignKey
ALTER TABLE "Factura" ADD CONSTRAINT "Factura_ordenDeTrabajoId_fkey" FOREIGN KEY ("ordenDeTrabajoId") REFERENCES "OrdenDeTrabajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Factura" ADD CONSTRAINT "Factura_archivoId_fkey" FOREIGN KEY ("archivoId") REFERENCES "Archivo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Factura" ADD CONSTRAINT "Factura_cargadoPorId_fkey" FOREIGN KEY ("cargadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
