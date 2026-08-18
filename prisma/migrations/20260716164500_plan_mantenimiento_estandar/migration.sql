-- CreateTable
CREATE TABLE "PlanMantenimientoEstandarItem" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipoIntervalo" "TipoIntervaloPlan" NOT NULL,
    "intervaloKm" INTEGER,
    "intervaloDias" INTEGER,
    "intervaloHoras" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "eliminadoEn" TIMESTAMP(3),
    "eliminadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanMantenimientoEstandarItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanMantenimientoEstandarItem_empresaId_idx" ON "PlanMantenimientoEstandarItem"("empresaId");

-- AddForeignKey
ALTER TABLE "PlanMantenimientoEstandarItem" ADD CONSTRAINT "PlanMantenimientoEstandarItem_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

