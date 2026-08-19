-- CreateTable
CREATE TABLE "NotificacionFallo" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "tipo" "TipoNotificacion" NOT NULL,
    "canal" "CanalNotificacion" NOT NULL,
    "destinatario" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificacionFallo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotificacionFallo_empresaId_createdAt_idx" ON "NotificacionFallo"("empresaId", "createdAt");

-- AddForeignKey
ALTER TABLE "NotificacionFallo" ADD CONSTRAINT "NotificacionFallo_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
