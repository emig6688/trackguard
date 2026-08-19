# Deploy a Vercel

## 1. Variables de entorno

Copiar `.env.example` como referencia y cargar en Vercel (Project Settings → Environment Variables):

- `DATABASE_URL` — Postgres (Neon, Supabase, RDS, etc.)
- `AUTH_SECRET` — generar con `npx auth secret`
- `CRON_SECRET` — cualquier valor random largo. **Obligatorio**: sin esto, los 5 endpoints `/api/cron/*` devuelven 401 siempre (fail-closed a propósito).
- `BLOB_READ_WRITE_TOKEN` — crear un Blob Store desde el dashboard de Vercel (Storage → Create Database → Blob) y copiar el token que genera. Sin esto, la subida de archivos (fotos de checklist/ticket, documentos, comprobantes) falla.
- `RESEND_API_KEY` / `RESEND_FROM_EMAIL` — opcionales, pero sin ellos el canal de email de las notificaciones solo deja constancia en el log (no manda nada real). `RESEND_FROM_EMAIL` tiene que ser un remitente de un dominio **verificado en el dashboard de Resend** (SPF/DKIM) — no puede ser una casilla de Office 365 ajena a Resend. Sin dominio verificado, Resend entrega solo a la cuenta dueña de la API key.

## 2. Base de datos

Antes del primer deploy (o después de cada `git pull` con migraciones nuevas):

```bash
npx prisma migrate deploy
```

Esto aplica las migraciones de `prisma/migrations/` contra `DATABASE_URL` sin generar una nueva (a diferencia de `migrate dev`, pensado para desarrollo local). Correrlo desde CI/CD o manualmente antes de que el deploy nuevo reciba tráfico.

## 3. Crons (`vercel.json`)

El plan **Hobby** de Vercel solo permite crons con frecuencia diaria (no horaria). Los 5 crons de la app ya están configurados así:

| Cron | Horario (UTC) | Nota |
|---|---|---|
| `planes-mantenimiento` | 12:00 | diario |
| `vencimientos-documentacion` | 12:00 | diario |
| `snapshot-disponibilidad` | 12:00 | diario |
| `resumen-operativos` | 20:00 | diario — antes corría cada hora, ver abajo |
| `devoluciones-pendientes` | 21:00 | diario — antes corría cada hora, ver abajo |

`resumen-operativos` y `devoluciones-pendientes` usan el campo `horaEnvio` configurable por empresa en **Mantenedor → Notificaciones** solo como interruptor de encendido/apagado — en el plan Hobby el envío real ocurre una vez al día a la hora fija de arriba, no a la hora que cada empresa elija ahí. Si el proyecto pasa a un plan que soporte crons horarios (Pro), se puede volver a cambiar `vercel.json` a `"0 * * * *"` y restaurar la comparación de `horaEnvio` contra la hora actual en `app/api/cron/resumen-operativos/route.ts` y `app/api/cron/devoluciones-pendientes/route.ts` (está documentado en un comentario en cada archivo).

Confirmar contra la [documentación de límites de Vercel](https://vercel.com/docs/cron-jobs/usage-and-pricing) vigente al momento del deploy cuántos cron jobs admite el plan elegido.

## 4. Verificación post-deploy

- Login con un usuario real y confirmar que la sesión persiste.
- Probar cada uno de los 5 crons manualmente una vez con `curl -H "Authorization: Bearer $CRON_SECRET" https://tu-dominio/api/cron/<nombre>` para confirmar que corren sin el trigger de Vercel.
- Subir un archivo (foto de checklist o documento) para confirmar que `BLOB_READ_WRITE_TOKEN` funciona.
- Si se configuró Resend, mandar una notificación de prueba y confirmar que llega (no solo que quedó en el log).
