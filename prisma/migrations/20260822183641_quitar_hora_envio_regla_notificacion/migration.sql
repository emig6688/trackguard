-- El horario de envío de los avisos diarios (resumen de vehículos
-- operativos, resumen de guardia) dejó de ser configurable por regla: con
-- el plan Hobby de Vercel el cron corre siempre a una hora fija para todas
-- las empresas, así que el campo quedó sin uso (solo servía como on/off
-- redundante con "activo").
ALTER TABLE "ReglaNotificacion" DROP COLUMN "horaEnvio";
