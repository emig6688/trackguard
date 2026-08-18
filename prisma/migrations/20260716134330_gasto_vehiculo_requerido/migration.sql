-- DropForeignKey
ALTER TABLE "Gasto" DROP CONSTRAINT "Gasto_vehiculoId_fkey";

-- AlterTable
ALTER TABLE "Gasto" ALTER COLUMN "vehiculoId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

