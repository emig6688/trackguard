-- CreateEnum
CREATE TYPE "MomentoChecklist" AS ENUM ('PRESALIDA', 'CIERRE');

-- AlterTable
ALTER TABLE "ChecklistRealizado" ADD COLUMN "momento" "MomentoChecklist" NOT NULL DEFAULT 'PRESALIDA';
