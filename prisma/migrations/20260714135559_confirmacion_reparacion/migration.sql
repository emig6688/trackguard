-- CreateEnum
CREATE TYPE "EstadoConfirmacionReparacion" AS ENUM ('PENDIENTE', 'CONFIRMADA', 'RECHAZADA');

-- AlterTable
ALTER TABLE "OrdenDeTrabajo" ADD COLUMN     "confirmacionReparacion" "EstadoConfirmacionReparacion",
ADD COLUMN     "confirmacionReparacionComentario" TEXT;

