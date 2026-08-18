-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "dni" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_dni_key" ON "Usuario"("dni");
