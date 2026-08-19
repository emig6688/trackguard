# Resumen — plan de mejoras post-auditoría

Rama: `mejoras-post-auditoria` (5 commits sobre el baseline `9012262`). Cada fase corrió
`tsc --noEmit` + `npm run lint` + `npm run build` limpios antes de commitear.

```
2fd54db fix(seguridad): Fase 1 — cierre de brechas críticas
77e4416 fix(negocio): Fase 2 — correcciones de lógica
5e7641b feat: Fase 3 — horas de frío, averías y trazabilidad
0b1490c chore: Fase 4 — preparación de deploy a Vercel
```

Explícitamente fuera de este plan (a pedido del usuario): nada de medición de temperatura ni
sensores.

## Fase 1 — Seguridad crítica

- **1.1 Fuga de datos entre empresas**: `Usuario` queda fuera del cliente scoped por diseño
  (email/dni únicos globales), así que cada `prisma.usuario.findMany` por rol necesitaba
  `empresaId` a mano. Se creó `usuariosDeEmpresaPorRol` en `lib/permisos.ts` y se reemplazaron
  los 8 call-sites vulnerables en `lib/notificaciones.ts`, `lib/checklist.ts`, `lib/panol.ts`,
  `app/_actions/ordenesTrabajo.ts`, `app/_actions/compras.ts`, más 4 `<select>` de UI sin
  filtrar (compras, ordenes-trabajo, estadísticas de guardia, devoluciones nueva).
- **1.2 IDOR**: se agregó validación de tenant (vehículo, template de checklist, chofer) antes
  de crear en `gastos.ts`, `combustible.ts`, `checklists.ts`, `devoluciones.ts`; en
  `eventosRuta.ts` se movió la validación del vehículo a ANTES del `create` (antes validaba
  después, dejando un `EventoRuta` con FK cruzada si fallaba).
- **1.3 Crons fail-closed**: los 5 endpoints `/api/cron/*` pasaron de fail-open
  (`if (secret && header !== ...)`) a fail-closed (`if (!secret || header !== ...)`).
  `planes-mantenimiento` ya tenía el chequeo (el plan original asumía que faltaba).
- **1.4 Revalidación de rol**: `agregarRepuesto`/`eliminarRepuestoUsado` en
  `ordenesTrabajo.ts` solo exigían sesión — ahora exigen el mismo gate de rol que
  `completarItemsPreventivos` y bloquean si la OT está COMPLETADA/CANCELADA.
- **1.5 Rate limiting de login**: tabla `IntentoLogin` + bloqueo de 15 min tras 6 intentos
  fallidos por identificador+IP en `auth.ts`.
- **1.6 CSV formula injection**: `lib/csv.ts` antepone `'` a valores que empiezan con
  `= + - @` o tab/CR.
- **1.7 Error handling en descarga de archivos**: `app/api/archivos/[id]/route.ts` envuelve
  todo (incluyendo `requireSession()`) en try/catch, mapea `AutorizacionError` a 401.

## Fase 2 — Lógica de negocio

- **2.1 Stock de pañol negativo**: `descontarStockYVerificarMinimo` ahora corre en
  `$transaction`, chequea `stockActual >= cantidadUsada` antes de descontar, y
  `agregarRepuesto` descuenta el stock ANTES de crear el `OTRepuesto` (si no hay stock, no
  queda un repuesto cargado sin descuento).
- **2.3 Bug de planes AMBOS**: `lib/cronograma.ts` tenía un `continue` que cortaba la
  evaluación de km si el plan tenía `intervaloDias` — un plan tipo AMBOS nunca llegaba a
  evaluar el driver de km. Se sacaron los `continue`, ahora evalúa ambos.
- **2.4 Aislamiento de errores en crons**: los 5 crons envuelven cada iteración del loop
  principal en try/catch, loguean con contexto y devuelven un resumen `{ok, errores}`.
- **2.5 Idempotencia**: `ReglaNotificacion.ultimoEnvioEn` + un "claim" atómico
  (`updateMany` condicional) antes de mandar, para que un reintento de Vercel en la misma
  franja no duplique el aviso.
- **2.6 Visibilidad de fallos de notificación**: nuevo modelo `NotificacionFallo` — antes
  un fallo de WhatsApp/email se perdía en el log del servidor; ahora se persiste (canal,
  destinatario, motivo real del proveedor) y se muestra en `/notificaciones`.

## Fase 3 — Funcionalidad nueva

- **3.a Horas de equipo de frío**: nuevo campo `ChecklistRealizado.momento`
  (PRESALIDA/CIERRE). El chofer ahora tiene un segundo acceso "Checklist de cierre" en
  `/mobile/inicio`. Al completar un cierre, `registrarHorasEquipoFrioSiCorresponde` busca el
  pre-salida del mismo día+chofer+vehículo y suma la diferencia a
  `Vehiculo.horasEquipoFrio` — si falta cualquiera de los dos, o ya se sumó un cierre hoy, la
  medición se descarta sin adivinar. La edición manual del campo queda como override
  (documentado en la UI).
- **3.b Averías de equipo de frío**: nueva área `EQUIPO_FRIO` en `AreaReparacionOT` +
  set de palabras clave propio en `lib/clasificador-averias.ts` (termo king, carrier, reefer,
  no enfría, etc.), separado de MOTOR (que antes absorbía "temperatura"/"refrigerante").
- **3.c Email vía Resend**: `lib/email.ts` ahora captura y persiste el motivo real que
  devuelve Resend (antes quedaba como el string genérico `"error_proveedor"`). Documentado en
  `.env.example` que `RESEND_FROM_EMAIL` necesita un dominio verificado en Resend, no una
  casilla de Office 365.
- **3.d Trazabilidad**: `lib/pdf/reporte-trazabilidad.tsx` +
  `app/api/export/trazabilidad-pdf/route.tsx` — PDF por vehículo (rango de fechas, default
  último año) con mantenimientos completados, planes preventivos, resumen de checklists,
  documentación vigente y horas de frío del período. Botón "Reporte de trazabilidad" en
  `/vehiculos/[id]`.

## Fase 4 — Deploy a Vercel

- Los 2 crons horarios (`resumen-operativos`, `devoluciones-pendientes`) pasaron a diarios —
  **el plan Hobby de Vercel no soporta crons horarios**. `horaEnvio` queda como
  interruptor on/off del aviso, no como la hora exacta de envío (ver comentario en cada
  route.ts y en `DEPLOY.md`).
- `app/error.tsx` y `app/(mobile)/mobile/error.tsx` (no existían).
- `next-auth` pinneado a `5.0.0-beta.31` exacto (sin `^`); `shadcn` movido a devDependencies.
- Exports masivos (`combustible`, `gastos`, `costos`, `compras-excel`) acotados a último año
  por defecto (antes sin límite); `maxDuration = 60` en los exports PDF/Excel más pesados.
- `DEPLOY.md` nuevo: variables de entorno, `prisma migrate deploy`, tabla de horarios de
  crons, checklist de verificación post-deploy.
- `eslint.config.mjs` ya existía (el plan asumía que faltaba) — no se tocó.

## Verificación hecha esta noche

- `tsc --noEmit` / `npm run lint` / `npm run build` limpios en cada fase y al final.
- Diff completo revisado (`git diff master...mejoras-post-auditoria`, 58 archivos).
- **Aislamiento multi-tenant**: con los 2 clientes reales de la base (MEAT S.A. y LA
  SUPERIOR), logueado como admin de MEAT S.A. se confirmó que `/usuarios` y `/choferes` NO
  muestran usuarios de LA SUPERIOR (el admin `mgarcia@lasuperior.com.ar` no aparece en
  ningún listado) — exactamente la clase de bug que cerró la Fase 1.1.
- **Flujo checklist pre-salida → cierre → horasEquipoFrio**: probado end-to-end con un
  chofer y vehículo de prueba (creados y eliminados en esta sesión, sin dejar rastro en
  datos reales) — completar ambos checklists sumó correctamente las horas transcurridas a
  `Vehiculo.horasEquipoFrio`.
- **Reporte de trazabilidad**: generado para un vehículo real (AB 120), PDF válido de ~16KB.
- Durante la verificación se encontró y corrigió que el servidor de desarrollo que ya
  estaba corriendo tenía el Prisma Client desactualizado (de antes de las migraciones de
  Fase 3) — se reinició para reflejar el schema actual; esto es solo un recordatorio
  operativo (mismo patrón mencionado en sesiones anteriores), no un bug en el código.

## Pendiente / requiere decisión humana

1. **Plan de Vercel**: confirmar contra la documentación vigente de Vercel cuántos cron jobs
   admite el plan Hobby antes de deployar los 5. Si se pasa a Pro, se puede revertir
   `vercel.json` a horario y restaurar la comparación de `horaEnvio` (comentada en el código).
2. **Dominio en Resend**: `RESEND_API_KEY`/`RESEND_FROM_EMAIL` no están configuradas
   localmente — no se pudo probar un envío de email real. Falta verificar un dominio propio
   en el dashboard de Resend antes de deployar (sin esto, los emails no llegan a los
   destinatarios reales, solo a la cuenta dueña de la API key).
3. **Blob store de Vercel**: `BLOB_READ_WRITE_TOKEN` requiere crear el store manualmente
   desde el dashboard de Vercel (paso documentado en `DEPLOY.md`, no automatizable).
4. **`npm audit`**: al correr `npm install` (necesario para pinnear next-auth) apareció un
   reporte de 20 vulnerabilidades (6 moderate, 12 high, 2 critical) en dependencias
   transitivas — no se tocó (`npm audit fix --force` puede romper versiones), queda para una
   revisión separada y deliberada.
5. **Fase 3.d (trazabilidad)** cubre mantenimientos/preventivo/checklists/documentación/horas
   de frío tal como pedía el plan; si se quiere sumar más secciones (ej. historial de
   combustible o gastos por vehículo) es una extensión aparte, no incluida acá.
