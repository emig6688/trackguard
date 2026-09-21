-- AlterEnum
ALTER TYPE "TipoNotificacion" ADD VALUE 'TEMPERATURA_FUERA_DE_RANGO';

-- AlterTable
ALTER TABLE "Empresa" ADD COLUMN     "temperaturaMaximaFrio" DECIMAL(5,2),
ADD COLUMN     "temperaturaMinimaFrio" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "Vehiculo" ADD COLUMN     "tieneSensorFrio" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "SensorFrio" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "vehiculoId" TEXT NOT NULL,
    "dispositivoId" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "ultimaLecturaEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SensorFrio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LecturaFrio" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "sensorFrioId" TEXT NOT NULL,
    "vehiculoId" TEXT NOT NULL,
    "fechaHora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "temperatura" DECIMAL(5,2),
    "equipoEncendido" BOOLEAN,
    "latitud" DOUBLE PRECISION,
    "longitud" DOUBLE PRECISION,
    "kmOdometro" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LecturaFrio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertaFrio" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "sensorFrioId" TEXT NOT NULL,
    "vehiculoId" TEXT NOT NULL,
    "tipo" "TipoNotificacion" NOT NULL,
    "detalle" TEXT,
    "resuelta" BOOLEAN NOT NULL DEFAULT false,
    "resueltaEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertaFrio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SensorFrio_vehiculoId_key" ON "SensorFrio"("vehiculoId");

-- CreateIndex
CREATE UNIQUE INDEX "SensorFrio_dispositivoId_key" ON "SensorFrio"("dispositivoId");

-- CreateIndex
CREATE INDEX "SensorFrio_empresaId_idx" ON "SensorFrio"("empresaId");

-- CreateIndex
CREATE INDEX "LecturaFrio_vehiculoId_fechaHora_idx" ON "LecturaFrio"("vehiculoId", "fechaHora");

-- CreateIndex
CREATE INDEX "LecturaFrio_empresaId_idx" ON "LecturaFrio"("empresaId");

-- CreateIndex
CREATE INDEX "AlertaFrio_vehiculoId_resuelta_idx" ON "AlertaFrio"("vehiculoId", "resuelta");

-- CreateIndex
CREATE INDEX "AlertaFrio_empresaId_idx" ON "AlertaFrio"("empresaId");

-- AddForeignKey
ALTER TABLE "SensorFrio" ADD CONSTRAINT "SensorFrio_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SensorFrio" ADD CONSTRAINT "SensorFrio_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LecturaFrio" ADD CONSTRAINT "LecturaFrio_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LecturaFrio" ADD CONSTRAINT "LecturaFrio_sensorFrioId_fkey" FOREIGN KEY ("sensorFrioId") REFERENCES "SensorFrio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LecturaFrio" ADD CONSTRAINT "LecturaFrio_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertaFrio" ADD CONSTRAINT "AlertaFrio_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertaFrio" ADD CONSTRAINT "AlertaFrio_sensorFrioId_fkey" FOREIGN KEY ("sensorFrioId") REFERENCES "SensorFrio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertaFrio" ADD CONSTRAINT "AlertaFrio_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
