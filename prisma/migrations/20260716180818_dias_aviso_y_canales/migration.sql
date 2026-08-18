-- AlterEnum
ALTER TYPE "CanalNotificacion" ADD VALUE 'EMAIL';

-- AlterTable: agregar columnas nuevas primero (sin tocar las viejas todavía)
ALTER TABLE "Documento" ADD COLUMN "diasAvisoNotificados" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
ALTER TABLE "ReglaNotificacion" ADD COLUMN "canales" "CanalNotificacion"[] DEFAULT ARRAY['WHATSAPP']::"CanalNotificacion"[];
ALTER TABLE "ReglaNotificacion" ADD COLUMN "diasAviso" INTEGER[] DEFAULT ARRAY[15, 7]::INTEGER[];

-- Backfill: migrar el estado de los campos viejos a los nuevos antes de dropearlos
UPDATE "Documento"
SET "diasAvisoNotificados" =
  (CASE WHEN "notificado15DiasEn" IS NOT NULL THEN ARRAY[15] ELSE ARRAY[]::INTEGER[] END) ||
  (CASE WHEN "notificado7DiasEn" IS NOT NULL THEN ARRAY[7] ELSE ARRAY[]::INTEGER[] END);

UPDATE "ReglaNotificacion" SET "canales" = ARRAY["canal"]::"CanalNotificacion"[];

-- AlterTable: dropear columnas viejas ya migradas
ALTER TABLE "Documento" DROP COLUMN "notificado15DiasEn";
ALTER TABLE "Documento" DROP COLUMN "notificado7DiasEn";
ALTER TABLE "ReglaNotificacion" DROP COLUMN "canal";
