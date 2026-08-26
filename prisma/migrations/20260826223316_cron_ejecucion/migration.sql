-- CreateTable
CREATE TABLE "CronEjecucion" (
    "nombre" TEXT NOT NULL,
    "ejecutadoEn" TIMESTAMP(3) NOT NULL,
    "creadas" INTEGER NOT NULL DEFAULT 0,
    "actualizadas" INTEGER NOT NULL DEFAULT 0,
    "erroresCount" INTEGER NOT NULL DEFAULT 0,
    "errorDetalle" TEXT,

    CONSTRAINT "CronEjecucion_pkey" PRIMARY KEY ("nombre")
);
