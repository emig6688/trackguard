import "server-only";
import { prisma } from "@/lib/prisma";

// Modelos de negocio que pertenecen a una única empresa. Usuario queda
// deliberadamente afuera: su email/dni tienen que seguir siendo únicos en
// toda la tabla (el login busca por email/dni sin saber todavía la empresa),
// así que cada archivo que toca Usuario agrega `empresaId` a mano en los
// where de listado/detalle/update, pero deja sin filtrar los chequeos de
// unicidad (mismo criterio ya usado en el resto del código para email/dni).
const MODELOS_CON_EMPRESA = new Set([
  "Vehiculo",
  "Documento",
  "PlanMantenimiento",
  "PlanMantenimientoEstandarItem",
  "TallerExterno",
  "OrdenDeTrabajo",
  "OTRepuesto",
  "Factura",
  "ArticuloPanol",
  "OrdenCompra",
  "CargaCombustible",
  "Gasto",
  "EventoRuta",
  "ChecklistTemplate",
  "TipoDocumentoConfig",
  "Archivo",
  "ReglaNotificacion",
  "DisponibilidadSnapshot",
  "Notificacion",
  "NotificacionFallo",
  "PushSubscription",
  "OTItemPreventivo",
  "ObservacionGuardia",
  "Devolucion",
  "DiaNoOperado",
]);

/**
 * Cliente de Prisma con el tenant ya inyectado: cualquier consulta sobre los
 * modelos de `MODELOS_CON_EMPRESA` queda automáticamente filtrada por
 * `empresaId`, y cualquier create() lo fuerza en los datos — así ningún
 * archivo que use este cliente puede, ni por accidente, leer o escribir
 * datos de otra empresa. Se obtiene siempre a través de requireRole/
 * requireSession/requireEmpresa en lib/permisos.ts, nunca instanciando esto
 * directamente en una página o acción.
 */
export function scopedPrisma(empresaId: string) {
  return prisma.$extends({
    name: "tenant-scope",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !MODELOS_CON_EMPRESA.has(model)) {
            return query(args);
          }

          // Los modelos varían (Empresa, PerfilChofer, etc. no tienen
          // empresaId), así que TypeScript no puede tipar `args` de forma
          // estricta acá — el `Set`/chequeo de arriba ya garantiza en
          // runtime que solo entran modelos con empresaId.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const argsAny = args as any;

          switch (operation) {
            case "findUnique":
            case "findUniqueOrThrow":
            case "update":
            case "delete":
              // La clave única queda en el nivel superior (cumple el tipo
              // WhereUniqueInput) y empresaId se agrega como filtro hermano —
              // mismo patrón que ya usa el resto del código
              // (ej. `where: { id, eliminadoEn: null }`).
              argsAny.where = { ...argsAny.where, empresaId };
              break;
            case "findFirst":
            case "findFirstOrThrow":
            case "findMany":
            case "updateMany":
            case "deleteMany":
            case "count":
            case "aggregate":
            case "groupBy":
              argsAny.where = { ...(argsAny.where ?? {}), empresaId };
              break;
            case "create":
              argsAny.data = { ...argsAny.data, empresaId };
              break;
            case "createMany":
            case "createManyAndReturn":
              argsAny.data = Array.isArray(argsAny.data)
                ? argsAny.data.map((d: object) => ({ ...d, empresaId }))
                : { ...argsAny.data, empresaId };
              break;
            case "upsert":
              argsAny.where = { ...argsAny.where, empresaId };
              argsAny.create = { ...argsAny.create, empresaId };
              argsAny.update = { ...argsAny.update, empresaId };
              break;
          }
          return query(args);
        },
      },
    },
  });
}

export type ScopedPrismaClient = ReturnType<typeof scopedPrisma>;
