# Deploy a Vercel

## 1. Variables de entorno

Copiar `.env.example` como referencia y cargar en Vercel (Project Settings → Environment Variables):

- `DATABASE_URL` — Postgres (Neon, Supabase, RDS, etc.). Si la base está detrás de un connection pooler (Supabase, PgBouncer), esta es la connection string **pooleada** (puerto 6543 en Supabase, con `?pgbouncer=true`) — la usa la app en runtime.
- `DIRECT_URL` — **obligatoria si `DATABASE_URL` usa un pooler** (ver arriba). Connection string **directa** (puerto 5432), la usa `prisma.config.ts` para que `prisma migrate deploy` funcione — contra un pooler en modo transacción, las migraciones fallan sin esto. Sin pooler (Postgres directo), no hace falta.
- `AUTH_SECRET` — generar con `npx auth secret`
- `CRON_SECRET` — cualquier valor random largo. **Obligatorio**: sin esto, los 5 endpoints `/api/cron/*` devuelven 401 siempre (fail-closed a propósito).
- `BLOB_READ_WRITE_TOKEN` — crear un Blob Store desde el dashboard de Vercel (Storage → Create Database → Blob) y copiar el token que genera. Sin esto, la subida de archivos (fotos de checklist/ticket, documentos, comprobantes) falla.
- `RESEND_API_KEY` / `RESEND_FROM_EMAIL` — opcionales, pero sin ellos el canal de email de las notificaciones solo deja constancia en el log (no manda nada real). `RESEND_FROM_EMAIL` tiene que ser un remitente de un dominio **verificado en el dashboard de Resend** (SPF/DKIM) — no puede ser una casilla de Office 365 ajena a Resend. Sin dominio verificado, Resend entrega solo a la cuenta dueña de la API key.
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` — para las notificaciones push reales (llegan al celular con la app cerrada). Generar el par una sola vez con `node -e "console.log(require('web-push').generateVAPIDKeys())"` y `VAPID_SUBJECT` es un `mailto:` de contacto. Sin estas 3, el botón "Activar notificaciones push" no hace nada (`lib/push.ts` queda en no-op).
- `OPENAI_API_KEY` — opcional. Sin esto, la carga de combustible no lee el ticket con IA (monto/litros/proveedor) — el chofer los completa a mano, como siempre (`lib/ocr-ticket-combustible.ts`).

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

**Por qué son 5 crons separados en vez de uno solo:** desde enero de 2026 Vercel levantó el límite de cantidad de cron jobs a 100 por proyecto en todos los planes, incluido Hobby — así que la cantidad ya no es una restricción. La única restricción real en Hobby es la frecuencia (una vez al día, ya resuelto arriba) y que Vercel puede disparar el cron en cualquier momento dentro de la hora indicada, no en el minuto exacto. Mantenerlos separados es la opción correcta: cada uno es una responsabilidad independiente, así que una falla o una corrida lenta en uno no afecta a los demás, y los logs/reintentos quedan aislados por job.

## 4. Verificación post-deploy

- Login con un usuario real y confirmar que la sesión persiste.
- Probar cada uno de los 5 crons manualmente una vez con `curl -H "Authorization: Bearer $CRON_SECRET" https://tu-dominio/api/cron/<nombre>` para confirmar que corren sin el trigger de Vercel.
- Subir un archivo (foto de checklist o documento) para confirmar que `BLOB_READ_WRITE_TOKEN` funciona.
- Si se configuró Resend, mandar una notificación de prueba y confirmar que llega (no solo que quedó en el log).
- Activar el push (botón junto a la campanita) en un dispositivo Android o desktop y disparar cualquier aviso que use el canal "En la app" — confirmar que llega una notificación real del sistema operativo con la app cerrada. En iOS, primero hay que agregar la app a la pantalla de inicio (Safari → Compartir → "Agregar a pantalla de inicio"); el botón lo explica si detecta iOS sin instalar.
