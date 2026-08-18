-- CreateEnum
CREATE TYPE "TipoNotificacion" AS ENUM ('VENCIMIENTO_DOCUMENTO_CHOFER', 'VENCIMIENTO_DOCUMENTO_VEHICULO', 'NUEVA_ORDEN_COMPRA', 'OT_COMPLETADA_CONFIRMACION');

-- CreateEnum
CREATE TYPE "CanalNotificacion" AS ENUM ('WHATSAPP');

-- CreateTable
CREATE TABLE "ReglaNotificacion" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "tipo" "TipoNotificacion" NOT NULL,
    "roles" "Rol"[],
    "canal" "CanalNotificacion" NOT NULL DEFAULT 'WHATSAPP',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReglaNotificacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReglaNotificacion_empresaId_tipo_key" ON "ReglaNotificacion"("empresaId", "tipo");

-- AddForeignKey
ALTER TABLE "ReglaNotificacion" ADD CONSTRAINT "ReglaNotificacion_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

