/**
 * Lista fija de todos los modelos de negocio, en el mismo orden en que
 * aparecen en prisma/schema.prisma. Prisma 7 no expone el DMMF en runtime de
 * forma simple, así que se mantiene a mano acá — si se agrega un modelo
 * nuevo al schema, hay que sumarlo también acá (scripts/backup-modelos.test
 * lo detecta si el nombre no existe en el cliente).
 *
 * El orden importa para restaurar-backup.ts (padres antes que hijos); para
 * el backup en sí no importa. La única referencia circular real del schema
 * es OrdenCompra.presupuestoAprobadoId <-> PresupuestoCompra.ordenCompraId,
 * por eso restaurar-backup.ts desactiva la verificación de FKs mientras
 * inserta en vez de depender solo de este orden.
 */
export const MODELOS_BACKUP = [
  "empresa",
  "reglaNotificacion",
  "notificacion",
  "notificacionFallo",
  "pushSubscription",
  "usuario",
  "perfilChofer",
  "intentoLogin",
  "vehiculo",
  "disponibilidadSnapshot",
  "tipoDocumentoConfig",
  "documento",
  "planMantenimiento",
  "planMantenimientoEstandarItem",
  "tallerExterno",
  "ordenDeTrabajo",
  "oTHistorialEstado",
  "oTItemPreventivo",
  "oTRepuesto",
  "factura",
  "oTDerivacionExterna",
  "articuloPanol",
  "ordenCompra",
  "ordenCompraItem",
  "presupuestoCompra",
  "checklistTemplate",
  "checklistItem",
  "checklistRealizado",
  "checklistRespuesta",
  "eventoRuta",
  "cargaCombustible",
  "gasto",
  "archivo",
  "observacionGuardia",
  "diaNoOperado",
  "devolucion",
  "productoDevuelto",
  "cambioDevolucion",
] as const;

export type ModeloBackup = (typeof MODELOS_BACKUP)[number];
