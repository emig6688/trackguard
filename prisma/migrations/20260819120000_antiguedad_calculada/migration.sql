-- AlterTable
-- La antigüedad ahora se calcula en el código a partir de Vehiculo.anio en
-- vez de cargarse a mano, así que la columna deja de tener sentido.
ALTER TABLE "Vehiculo" DROP COLUMN "antiguedadAnios";
