# Plan de mejoras TrackGuard — para ejecutar con Claude Code

**Cómo usar este documento:** pegalo como primer mensaje en Claude Code dentro de la carpeta `flota-frigorifico`, o guardalo como `PLAN-MEJORAS.md` en la raíz del proyecto y decile a Claude Code "seguí este plan fase por fase, marcá cada ítem con [x] al terminarlo, corré typecheck/build al final de cada fase y hacé un commit por fase". Las fases están ordenadas por dependencia: la seguridad va primero porque toca código que las fases siguientes van a modificar igual; el módulo nuevo de horas de frío va antes que el de trazabilidad porque el de trazabilidad puede querer mostrar ese dato.

No se incluye nada de medición de temperatura ni sensores — eso queda fuera de este plan a pedido explícito.

Antes de arrancar, decile a Claude Code que lea `AGENTS.md`, `prisma/schema.prisma` completo, `lib/permisos.ts`, `lib/tenant-prisma.ts` y `lib/ot-state-machine.ts` para tener el contexto real del proyecto — varios pasos de abajo dependen de nombres exactos de campos/modelos que hay que confirmar contra el schema actual, no asumirlos ciegamente de este documento.

---

## Fase 0 — Preparación

- [ ] Crear una rama nueva (`git checkout -b mejoras-post-auditoria`) para poder revisar todo el diff de la noche de una sola vez a la mañana.
- [ ] Confirmar que `npm run build`, `npx tsc --noEmit` y `npm run lint` corren limpios ANTES de empezar (baseline), para no confundir errores preexistentes con errores nuevos.
- [ ] Al final de cada fase de abajo: correr `npx tsc --noEmit` y `npm run build`, arreglar lo que rompa, y recién ahí hacer `git commit` con un mensaje que identifique la fase (ej. `fix(seguridad): scoping de empresaId en notificaciones`).

---

## Fase 1 — Seguridad crítica (bloqueante para multi-tenant)

### 1.1 Fuga de datos entre empresas en notificaciones
Buscar TODOS los `prisma.usuario.findMany(...)` (o `prisma.usuario.findFirst`) que no incluyan `empresaId` en el `where`, en particular:
- `lib/notificaciones.ts` (varias funciones que resuelven destinatarios por rol)
- `lib/checklist.ts`
- `lib/panol.ts`
- `app/_actions/compras.ts` (función de notificar compra pendiente/realizada)
- `app/_actions/ordenesTrabajo.ts` (notificación al completar OT)

Para cada uno: agregar `empresaId` al `where`. Idealmente crear un helper único, por ejemplo `usuariosDeEmpresaPorRol(empresaId, roles[])` en `lib/permisos.ts` o `lib/notificaciones.ts`, y reemplazar todos los call-sites por ese helper, para que este bug no se pueda reintroducir por error en el futuro.

También corregir los `<select>` de UI que listan usuarios sin filtrar por empresa (mismo bug, visible en pantalla):
- `app/(guardia)/guardia/devoluciones/nueva/page.tsx` (combo de chofer)
- `app/(admin)/compras/page.tsx` (filtro de chofer)
- `app/(admin)/ordenes-trabajo/page.tsx` (filtro de chofer)
- `app/(guardia)/guardia/estadisticas/page.tsx` (lista de choferes)

**Definición de terminado:** grep de `prisma.usuario.findMany` y `prisma.usuario.findFirst` en todo `app/` y `lib/` — cada resultado debe tener `empresaId` en el `where`, salvo los casos legítimos donde de verdad se necesita buscar cross-tenant (ej. `auth.ts` al hacer login, donde todavía no se sabe la empresa — dejar ese sin tocar).

### 1.2 IDOR: validar pertenencia al tenant antes de crear registros con FK del cliente
En estas acciones, el id recibido de un formulario (`vehiculoId`, `choferId`, `templateId`) se usa para crear un registro relacionado sin validar antes que pertenezca a la empresa del usuario logueado:
- `app/_actions/gastos.ts` (`registrarGasto`)
- `app/_actions/combustible.ts` (`registrarCargaCombustible`)
- `app/_actions/checklists.ts` (`registrarChecklist`)
- `app/_actions/eventosRuta.ts` (`registrarEventoRuta` — hoy valida el vehículo DESPUÉS de crear el registro; hay que mover la validación antes)
- `app/_actions/devoluciones.ts` (`crearDevolucion`, validar `choferId`)

Patrón de fix: antes del `create()`, hacer `await prisma.vehiculo.findUniqueOrThrow({ where: { id } })` (o el modelo que corresponda) usando el cliente **scoped** de `tenant-prisma.ts` — si el id no pertenece al tenant, esa llamada ya tira error y el flujo se corta antes de escribir nada.

### 1.3 Cron endpoints
- `app/api/cron/planes-mantenimiento/route.ts`: **hoy no tiene ningún chequeo de `CRON_SECRET`** — agregar el mismo bloque que ya usan los otros 4 crons.
- En los 5 archivos de `app/api/cron/*/route.ts`: cambiar la condición de "fail-open" a "fail-closed". Hoy es más o menos así:
  ```ts
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  ```
  Cambiar a que sea obligatorio, por ejemplo:
  ```ts
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  ```

### 1.4 Revalidación de rol en acciones de repuestos de OT
En `app/_actions/ordenesTrabajo.ts`, `agregarRepuesto` y `eliminarRepuestoUsado` hoy solo exigen `requireSession()`. Agregar el mismo chequeo de rol que ya usa `completarItemsPreventivos` en el mismo archivo (roles de mantenimiento + `puedeMecanicoAccionar` para `MECANICO_INTERNO`), y además bloquear ambas acciones si `ot.estado` es `COMPLETADA` o `CANCELADA` (esto también resuelve el hallazgo 2.2 de la Fase 2 de abajo — no hace falta duplicar el fix).

### 1.5 Rate limiting de login
En `auth.ts`, agregar límite de intentos fallidos por identificador (email/DNI) y por IP en el `authorize` de Credentials. No hace falta infraestructura nueva: alcanza con una tabla simple en Postgres (`IntentoLogin` con `identificador`, `ip`, `exitoso`, `creadoEn`) o un contador en memoria con ventana deslizante si se prefiere algo más liviano para arrancar; bloquear temporalmente (ej. 15 minutos) tras 5-8 intentos fallidos consecutivos para el mismo identificador. Documentar la decisión en el propio código con un comentario corto.

### 1.6 CSV formula injection
En `lib/csv.ts`, función que arma cada celda: si el valor empieza con `=`, `+`, `-`, `@`, tab o retorno de carro, anteponer un `'` antes de aplicar el escapado existente de comillas/comas/saltos de línea.

### 1.7 Manejo de error en descarga de archivos
En `app/api/archivos/[id]/route.ts`, envolver TODA la función (incluyendo `requireSession()`, no solo `leerArchivo`) en el try/catch, mapeando `AutorizacionError` a un 401 explícito en vez de dejar que Next.js devuelva un 500 genérico.

---

## Fase 2 — Correcciones de lógica de negocio

### 2.1 Stock de pañol negativo
En `lib/panol.ts`, antes del `update` que hace `decrement` de `stockActual`, verificar que `articulo.stockActual >= cantidadUsada`; si no, devolver un error de validación legible (no dejar que Postgres/Prisma tire una excepción genérica). Envolver la lectura + el `decrement` en `prisma.$transaction(...)` para evitar condición de carrera entre dos mecánicos cargando el mismo repuesto casi al mismo tiempo. Revisar también el cálculo de `cantidadSolicitada` de la orden de compra automática para que no calcule de más si el stock llegó a estar en negativo antes de este fix.

### 2.2 OT cerrada no debería aceptar cambios de repuestos
Ya cubierto en el punto 1.4 (bloquear `agregarRepuesto`/`eliminarRepuestoUsado` si `ot.estado` es `COMPLETADA`/`CANCELADA`). Si en 1.4 no se llegó a hacer, hacerlo acá.

### 2.3 Cronograma: bug en planes tipo `AMBOS`
En `lib/cronograma.ts`, función `planesPrevistos`: hoy, si `plan.intervaloDias != null`, hace `continue` antes de evaluar el km, así que un plan `AMBOS` (km + calendario) nunca calcula/muestra el avance por km en el cronograma aunque ya esté vencido por ese lado. Cambiar la lógica para que compare ambos drivers (km y días) cuando el plan es `AMBOS`, y muestre/priorice el que esté más cerca de vencer o ya vencido — igual que ya hace correctamente el cron real (`app/api/cron/planes-mantenimiento/route.ts`, función `planVencido`, que sirve de referencia de la lógica correcta).

### 2.4 Aislamiento de errores en los 5 cron jobs
En cada uno de `app/api/cron/planes-mantenimiento`, `vencimientos-documentacion`, `resumen-operativos`, `devoluciones-pendientes`, `snapshot-disponibilidad` (todos en `app/api/cron/*/route.ts`): envolver el cuerpo de cada iteración del loop principal (por vehículo/documento/empresa) en su propio try/catch, loguear el error (`console.error` con suficiente contexto: qué entidad, qué empresa) y continuar con el resto en vez de dejar que una excepción individual aborte toda la corrida. Al final, devolver en la respuesta un resumen de cuántos procesados OK y cuántos con error.

### 2.5 Idempotencia de `resumen-operativos` y `devoluciones-pendientes`
Estos dos crons corren cada hora y hoy solo comparan la hora configurada contra la hora actual, sin persistir que ya se envió. Agregar un registro de "último envío" (puede ser un campo `ultimoResumenEnviadoEn` en el modelo que corresponda, o una tabla simple de log de envíos) para que un reintento de Vercel dentro de la misma hora no duplique el mensaje. Tomar como referencia el patrón que ya usa bien `vencimientos-documentacion` (`Documento.diasAvisoNotificados`) y `snapshot-disponibilidad` (`upsert` sobre constraint única).

### 2.6 Visibilidad de fallos de notificación
En `lib/notificaciones.ts`, función `enviarPorCanalesConfigurados` (o como se llame la que dispara email/WhatsApp en paralelo): hoy el resultado de `enviarEmail`/`enviarWhatsapp` se descarta. Persistir el resultado (éxito/error/motivo) en la fila de `Notificacion` correspondiente (agregar campos si hace falta, ej. `estadoEnvioEmail`, `estadoEnvioWhatsapp`, `errorEnvio`), y mostrar ese estado en la pantalla de notificaciones (`app/(admin)/notificaciones/page.tsx`) para que un admin pueda ver de un vistazo qué avisos no llegaron realmente, en vez de asumir que "está configurado" significa "llegó".

---

## Fase 3 — Oportunidades funcionales nuevas

### 3.a Conteo de horas de equipo de frío vía checklist

Objetivo: registrar automáticamente las horas de uso del equipo de frío por viaje, usando el timestamp del checklist de pre-salida como inicio y el del checklist de cierre de ruta como fin, sumando esa duración a `Vehiculo.horasEquipoFrio`. Si para un mismo viaje/vehículo/día falta cualquiera de los dos checklists (no se hizo el de pre-salida, o no se hizo el de cierre), **descartar esa medición** — no sumar nada y no adivinar.

Pasos sugeridos (confirmar contra el modelo real antes de implementar, no asumir nombres de campo):
1. Leer `prisma/schema.prisma` (modelos `ChecklistRealizado`, `ChecklistTemplate`, `EventoRuta`) y `lib/checklist.ts`/`app/_actions/checklists.ts` para entender cómo se distingue hoy un checklist de "pre-salida" de uno de "cierre de ruta", y cómo se agrupan los checklists de un mismo viaje (¿por `EventoRuta`? ¿por fecha + vehículo? ¿por chofer + fecha?).
2. Si no existe ya, agregar el campo de tipo/momento del checklist (ej. enum `PRESALIDA` / `CIERRE`, si no está modelado así hoy) y asegurarse de que cada `ChecklistRealizado` tenga timestamp confiable.
3. Al completarse un checklist de tipo CIERRE, buscar el checklist PRESALIDA correspondiente al mismo vehículo del mismo viaje/día. Si existe: calcular `horas = (timestamp cierre - timestamp presalida) / 3600000`, redondear con un criterio sensato (ej. a 1 decimal), y hacer `prisma.vehiculo.update({ where: { id }, data: { horasEquipoFrio: { increment: horas } } })` dentro del mismo flujo de `registrarChecklist` (usando el cliente scoped, y protegido contra doble conteo si el cierre se reintenta — usar alguna marca de "ya contabilizado" en el registro de cierre).
4. Si no existe el checklist PRESALIDA correspondiente (o el de CIERRE llega sin que haya uno previo abierto), no sumar horas, y opcionalmente dejar un registro/log de "medición descartada por checklist incompleto" para que el administrador lo pueda ver (podría ser una notificación de baja prioridad o un campo en el propio checklist).
5. Actualizar `plan-mantenimiento-preventivo.md` o el código donde corresponda para que quede documentado que `horasEquipoFrio` ahora se alimenta automáticamente de este flujo (y ya no depende solo de la edición manual en el form de vehículo — dejar la edición manual como override disponible para correcciones, pero no como única fuente).
6. Migración de Prisma si se agregan campos nuevos (`npx prisma migrate dev --name horas_equipo_frio_checklist`).

**Definición de terminado:** completar un checklist de pre-salida y luego uno de cierre para el mismo vehículo suma horas correctamente a `Vehiculo.horasEquipoFrio`; completar solo uno de los dos no suma nada; los planes de mantenimiento tipo HORAS del equipo de frío ahora tienen una chance real de vencer solos sin edición manual.

### 3.b Clasificación correcta de averías de equipo de frío

1. En `prisma/schema.prisma`, agregar un valor al enum `AreaReparacionOT` (ej. `EQUIPO_FRIO`) y migrar.
2. En `lib/clasificador-averias.ts`, sacar del set de palabras clave de `MOTOR` las que en realidad describen al equipo de frío/reefer ("temperatura", "recalent", "sobrecalient", "refrigerante" cuando se refiere al equipo, "anticongelante" si aplica al motor auxiliar) y crear un set de palabras clave propio para `EQUIPO_FRIO` (ej. "equipo de frío", "reefer", "no enfría", "no llega a temperatura", "termo king", "carrier", "setpoint", "compresor del frío", "unidad de frío", "motor auxiliar"). Cuidado con ambigüedad real (ej. "recalienta" puede referirse al motor del camión O al motor auxiliar del equipo de frío) — si el texto es ambiguo, priorizar según qué palabras más específicas aparezcan, y dejar que la clasificación resultante sea editable a mano por el mecánico igual que hoy (esto no debe ser 100% automático e infalible, solo mejor que hoy).
3. Revisar `buscarOTAbiertaMismoProblema` (o como se llame la función de fusión de reportes en una misma OT abierta) para que compare dentro de la misma categoría (`EQUIPO_FRIO` contra `EQUIPO_FRIO`, no contra `MOTOR`).
4. Actualizar cualquier UI que liste/filtre por `AreaReparacionOT` (buscar usos del enum en `components/` y `app/(admin)/ordenes-trabajo/`) para que muestre la nueva categoría con un label razonable ("Equipo de frío").

**Definición de terminado:** un reporte de chofer con texto tipo "el equipo no enfría, sube la temperatura" se clasifica como `EQUIPO_FRIO`, no como `MOTOR`.

### 3.c Arreglar el envío de email (Resend) para que no dependa de Office 365

1. Revisar `lib/email.ts` y confirmar si hoy usa el SDK de Resend (`resend` npm package) o si en algún punto está atado a un flujo SMTP de Outlook/Office 365 (según `pendientes.txt`, el problema mencionado es específicamente con Outlook 365, no con Resend en sí — puede que el proyecto tenga dos caminos mezclados, o que el remitente configurado en Resend sea una casilla de Office 365 sin verificar correctamente).
2. La causa más común de que Resend "no funcione" con una casilla que no sea la propia es que el dominio/remitente (`RESEND_FROM_EMAIL`) no está verificado en la cuenta de Resend (SPF/DKIM/DMARC del dominio remitente no configurados) — Resend rechaza o va a spam si el dominio del `from` no está verificado. Confirmar en el código qué valor se usa como remitente, y dejar documentado en `.env.example` y en un comentario que `RESEND_FROM_EMAIL` debe ser una dirección de un dominio verificado en el dashboard de Resend (no una casilla de Office 365/Outlook, que no se puede verificar como remitente ajeno en Resend sin acceso DNS de ese dominio).
3. Si el objetivo es poder mandar desde cualquier casilla (no necesariamente de un dominio propio verificado), la alternativa correcta es usar un dominio propio del proyecto (ej. `notificaciones@trackguard.com.ar` o el dominio que corresponda) verificado en Resend, y no intentar enviar "como si fuera" una casilla de Office 365 — eso es justamente lo que las restricciones de Office 365 bloquean. Dejar esto explicado en un comentario o en el propio `README.md`.
4. Agregar manejo de error explícito en `enviarEmail`: hoy si falla, retorna un resultado que se descarta (ver 2.6) — con el fix de 2.6 esto ya queda visible, pero además loguear el motivo real que devuelve la API de Resend (dominio no verificado, remitente inválido, rate limit, etc.) para poder diagnosticarlo rápido.
5. Probar el envío real con una cuenta de prueba de Resend y un dominio verificado (o el modo sandbox de Resend, que permite mandar a la propia casilla del dueño de la cuenta sin verificar dominio) antes de dar esto por resuelto.

**Definición de terminado:** un email de prueba disparado desde el sistema llega a una casilla externa real (no solo a la cuenta de Resend del desarrollador), y cualquier fallo queda visible en el estado de la notificación (ver 2.6), no silencioso.

### 3.d Módulo de trazabilidad para auditoría (PDF con un click)

Objetivo: un botón (por vehículo, o por vehículo + rango de fechas) que genere un PDF con el historial completo necesario para mostrarle a una aseguradora en caso de accidente, a una inspección bromatológica/SENASA, o a un cliente interno de auditoría: mantenimientos realizados (OTs completadas con repuestos y costos), mantenimientos preventivos (planes y su cumplimiento), checklists realizados (con resultado y fotos si las hay), documentación vigente del vehículo (VTV, seguro, habilitaciones, con fechas de vencimiento), y — si ya está implementado el punto 3.a — horas de equipo de frío acumuladas en el período.

Pasos sugeridos:
1. Usar como referencia el patrón ya existente en `lib/pdf/reporte-costos.tsx`, `lib/pdf/reporte-oc.tsx`, `lib/pdf/reporte-ot.tsx` (todos con `@react-pdf/renderer`) y las rutas `app/api/export/*-pdf/route.tsx` — mantener la misma convención de proyecto en vez de introducir un patrón nuevo.
2. Crear `lib/pdf/reporte-trazabilidad.tsx` con el documento PDF: portada con datos del vehículo (patente, empresa, período del reporte), sección de mantenimientos (tabla de OTs completadas con fecha, tipo, repuestos, costo), sección de mantenimiento preventivo (planes vigentes y su estado de cumplimiento al momento del reporte), sección de checklists (fecha, resultado, quién lo hizo, observaciones), sección de documentación vigente (tipo, número, vencimiento, estado — vigente/vencido), y si aplica, sección de horas de equipo de frío del período.
3. Crear `app/api/export/trazabilidad-pdf/route.tsx`, siguiendo el mismo patrón de autenticación/scoping por empresa que ya usan los otros export routes (usar el cliente Prisma scoped, no el crudo), con parámetros `vehiculoId` y rango de fechas opcional (default: todo el historial, o el último año si no se especifica, para evitar el problema de reportes gigantes ya señalado en la revisión de calidad — ver Fase 4).
4. Agregar el botón "Generar reporte de auditoría" en `app/(admin)/vehiculos/[id]/page.tsx` (o donde tenga más sentido, ej. también accesible desde la ficha de documentos del vehículo), que linkee al endpoint anterior.
5. Validar con datos reales de un vehículo con historial (no solo uno vacío) que el PDF se genera sin timeout y con formato legible antes de darlo por terminado.

**Definición de terminado:** desde la ficha de un vehículo con historial real, un click descarga un PDF completo, prolijo, y con toda la información que pediría una aseguradora o una inspección, sin exponer datos de otras empresas (scoped correctamente).

---

## Fase 4 — Preparación de deploy a Vercel

- [ ] Crear el Blob store en el dashboard de Vercel y setear `BLOB_READ_WRITE_TOKEN` en las variables de entorno del proyecto (esto es un paso manual en el dashboard, no de código — dejarlo anotado como pendiente para el dueño si Claude Code no tiene acceso al dashboard de Vercel).
- [ ] Completar `.env.example` con las variables que el código realmente usa y hoy no están documentadas: `CRON_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (grep de `process.env.` en todo el árbol para confirmar que no falta ninguna más).
- [ ] Confirmar/ajustar `vercel.json`: los crons `resumen-operativos` y `devoluciones-pendientes` son horarios, lo que requiere plan Pro de Vercel. Si el plan va a ser Hobby, rediseñar esos dos crons para que corran una vez al día y procesen todas las horas configuradas pendientes en esa misma corrida (documentar la decisión que se tome).
- [ ] Agregar `app/error.tsx` (mensaje amigable + botón de reintentar) y uno específico en `app/(mobile)/error.tsx` para que un chofer no vea pantalla en blanco ante un error de Prisma u otra excepción no controlada.
- [ ] Agregar `eslint.config.mjs` apuntando a `eslint-config-next` (ya está como dependencia, falta el archivo de config) para que `npm run lint` sirva de algo.
- [ ] Pinnear `next-auth` a la versión beta exacta probada (sin `^`) en `package.json`, para que un `npm install` futuro no traiga un beta distinto sin aviso.
- [ ] Mover `shadcn` de `dependencies` a `devDependencies` en `package.json` (es un CLI de scaffolding, no se usa en runtime).
- [ ] En los endpoints de export (`app/api/export/*`), exigir o acotar por default un rango de fechas razonable (ej. último año) cuando no se especifica filtro, para evitar timeout/out-of-memory en tenants con mucho historial. Setear `export const maxDuration = 60` en las rutas de export/PDF si el plan de Vercel lo permite.
- [ ] Documentar (en `README.md` o en un `DEPLOY.md` nuevo) el paso manual de `npx prisma migrate deploy` contra la base de producción antes/después de cada deploy que cambie el schema, ya que no está automatizado en el build.

---

## Fase 5 — Verificación final

- [ ] `npx tsc --noEmit` sin errores.
- [ ] `npm run build` exitoso.
- [ ] `npm run lint` sin errores (una vez agregado el config de la Fase 4).
- [ ] Revisar manualmente el diff completo de la noche (`git diff main...mejoras-post-auditoria`) antes de mergear, prestando especial atención a los cambios de la Fase 1 (seguridad) por su sensibilidad.
- [ ] Probar a mano, con datos de prueba de al menos dos empresas distintas, que un usuario de la Empresa A ya no puede ver ni recibir notificaciones con datos de la Empresa B (verificación directa del fix más importante de la noche).
- [ ] Probar el flujo completo de checklist pre-salida → cierre de ruta y confirmar que `horasEquipoFrio` se actualiza como se espera.
- [ ] Generar un reporte de trazabilidad de prueba y revisarlo visualmente.
- [ ] Dejar un resumen corto (puede ser el propio mensaje final de Claude Code, o un `RESUMEN-NOCHE.md`) de qué se hizo, qué quedó pendiente, y qué requiere una decisión humana (ej. plan de Vercel, dominio para Resend) antes de deployar.
