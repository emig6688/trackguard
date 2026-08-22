-- Toggle en Mantenedor/Parámetros: si está activo, una OT generada por el
-- reporte de un chofer nace directo APROBADA y sin mecánico asignado (igual
-- que ya nace hoy una preventiva generada por cron), en vez de nacer
-- PENDIENTE_APROBACION esperando que el encargado de mantenimiento la
-- apruebe y asigne a mano.
ALTER TABLE "Empresa" ADD COLUMN "autoAprobacionMecanicosActiva" BOOLEAN NOT NULL DEFAULT false;
