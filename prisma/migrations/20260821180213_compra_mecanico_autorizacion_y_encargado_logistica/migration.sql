-- AlterEnum
ALTER TYPE "Rol" ADD VALUE 'ENCARGADO_LOGISTICA';

-- AlterEnum
ALTER TYPE "TipoNotificacion" ADD VALUE 'COMPRA_MECANICO_PENDIENTE_AUTORIZACION';

-- DropForeignKey
ALTER TABLE "DiaNoOperado" DROP CONSTRAINT "DiaNoOperado_choferId_fkey";

-- AlterTable
ALTER TABLE "Empresa" ADD COLUMN     "montoAutorizacionCompraMecanico" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "OrdenCompra" ADD COLUMN     "autorizadoMantenimientoEn" TIMESTAMP(3),
ADD COLUMN     "autorizadoMantenimientoPorId" TEXT,
ADD COLUMN     "estadoAutorizacionMantenimiento" "EstadoAutorizacionCompra" NOT NULL DEFAULT 'NO_REQUERIDA';

-- AddForeignKey
ALTER TABLE "OrdenCompra" ADD CONSTRAINT "OrdenCompra_autorizadoMantenimientoPorId_fkey" FOREIGN KEY ("autorizadoMantenimientoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiaNoOperado" ADD CONSTRAINT "DiaNoOperado_choferId_fkey" FOREIGN KEY ("choferId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
