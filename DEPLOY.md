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

El script `build` de `package.json` corre `prisma migrate deploy && next build`, así que **Vercel aplica las migraciones pendientes automáticamente en cada deploy**, antes de buildear — no hace falta correrlo a mano. (Aplica las migraciones de `prisma/migrations/` contra `DIRECT_URL`/`DATABASE_URL` sin generar una nueva, a diferencia de `migrate dev`, pensado para desarrollo local.)

Si de todas formas necesitás correrlo a mano contra producción (por ejemplo para probar antes de pushear), la connection string real no se puede sacar con `vercel env pull` si `DATABASE_URL`/`DIRECT_URL` están marcadas como "Sensitive" en Vercel (el pull trae un placeholder inválido) — conseguila desde el dashboard de Supabase (botón "Connect" del proyecto → Session pooler o Direct connection, puerto 5432) y corré:

```bash
set "DIRECT_URL=<connection string real>" && npx prisma migrate deploy
```

## 3. Crons (`vercel.json`)

El plan **Hobby** de Vercel solo permite crons con frecuencia diaria (no horaria). Los 6 crons de la app corren todos a la misma hora, `0 2 * * *` (02:00 UTC = 23:00 hora Argentina):

| Cron | Horario (UTC) | Nota |
|---|---|---|
| `planes-mantenimiento` | 02:00 | diario |
| `vencimientos-documentacion` | 02:00 | diario |
| `snapshot-disponibilidad` | 02:00 | diario |
| `resumen-operativos` | 02:00 | diario |
| `devoluciones-pendientes` | 02:00 | diario |
| `backup-diario` | 02:00 | diario — ver sección 4, Backups |

Los tipos de notificación horaria recurrente (resumen de vehículos operativos, devoluciones sin enviar) ya no tienen un selector de hora por empresa — es un simple on/off en **Mantenedor → Notificaciones**, y el envío real siempre ocurre a las 23:00 ART de arriba. El campo `ReglaNotificacion.horaEnvio` que existía para esto se eliminó (migración `quitar_hora_envio_regla_notificacion`).

**Por qué son crons separados en vez de uno solo:** desde enero de 2026 Vercel levantó el límite de cantidad de cron jobs a 100 por proyecto en todos los planes, incluido Hobby — así que la cantidad ya no es una restricción. La única restricción real en Hobby es la frecuencia (una vez al día, ya resuelto arriba) y que Vercel puede disparar el cron en cualquier momento dentro de la hora indicada, no en el minuto exacto. Mantenerlos separados es la opción correcta: cada uno es una responsabilidad independiente, así que una falla o una corrida lenta en uno no afecta a los demás, y los logs/reintentos quedan aislados por job.

## 4. Backups

El proyecto de Supabase está en el plan **free**, que no ofrece Point-in-Time Recovery ni backups diarios retenidos — si se borra o corrompe algo, Supabase no tiene con qué volver atrás. Hasta que se pueda pagar el plan Pro (que sí los incluye), el cron `backup-diario` es el único resguardo real:

- Todos los días a las 23:00 ART, vuelca **todas** las tablas de negocio (ver `lib/backup-modelos.ts`) a un JSON, lo comprime y lo sube como blob **privado** a Vercel Blob (`backups/AAAA-MM-DD.json.gz`). Guarda los últimos 14 días; los más viejos se borran solos en cada corrida.
- No es un `pg_dump` real (no incluye triggers/índices/secuencias, solo los datos) — alcanza para reconstruir la información ante un desastre, no para clonar la base tal cual.

**Para descargar un backup** (necesita `BLOB_READ_WRITE_TOKEN` en el `.env` desde donde se corra):

```bash
npm run backup:descargar            # el más reciente
npm run backup:descargar -- 2026-08-20   # una fecha puntual
```

**Para restaurarlo** contra la base que apunte `DATABASE_URL` en ese momento (revisar el `.env` antes de correr esto — inserta datos de verdad):

```bash
npm run backup:restaurar -- ./2026-08-23.json.gz --confirmo
```

En cuanto se pueda pagar Supabase Pro, activar ahí el backup diario/PITR nativo y este cron puede apagarse (sacarlo de `vercel.json`) o dejarse igual como resguardo adicional — no hace daño tenerlo.

## 5. Verificación post-deploy

- Login con un usuario real y confirmar que la sesión persiste.
- Probar cada uno de los crons manualmente una vez con `curl -H "Authorization: Bearer $CRON_SECRET" https://tu-dominio/api/cron/<nombre>` para confirmar que corren sin el trigger de Vercel — para `backup-diario` en particular, confirmar que el JSON de respuesta trae `ok: true` y conteos de filas mayores a 0.
- Subir un archivo (foto de checklist o documento) para confirmar que `BLOB_READ_WRITE_TOKEN` funciona.
- Si se configuró Resend, mandar una notificación de prueba y confirmar que llega (no solo que quedó en el log).
- Activar el push (botón junto a la campanita) en un dispositivo Android o desktop y disparar cualquier aviso que use el canal "En la app" — confirmar que llega una notificación real del sistema operativo con la app cerrada. En iOS, primero hay que agregar la app a la pantalla de inicio (Safari → Compartir → "Agregar a pantalla de inicio"); el botón lo explica si detecta iOS sin instalar.

## 6. `npm audit` — riesgo aceptado a propósito

Al día de la auditoría de comercialización (2026-08-25), `npm audit` reporta 5 vulnerabilidades
(2 moderate, 3 high) en dependencias transitivas: `deepmerge-ts` (vía `@prisma/config` →
`prisma`) y `uuid` (vía `exceljs`). Ninguna tiene un fix sin bajar de versión — `npm audit fix
--force` bajaría `prisma` de 7.x a 6.x y `exceljs` de 4.x a 3.x, ambos downgrades reales de una
dependencia directa. Se decidió conscientemente NO aplicar el downgrade (más riesgo de romper
algo que el de dejar la vulnerabilidad transitiva) — revisar `npm audit` cada tanto por si
aparece un fix real sin bajar de versión.
