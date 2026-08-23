import "server-only";
import { prisma } from "@/lib/prisma";

// Modelos de negocio que pertenecen a una única empresa. Usuario queda
// deliberadamente afuera: su email/dni tienen que seguir siendo únicos en
// toda la tabla (el login busca por email/dni sin saber todavía la empresa),
// así que cada archivo que toca Usuario agrega `empresaId` a mano en los
// where de listado/detalle/update, pero deja sin filtrar los chequeos de
// unicidad (mismo criterio ya usado en el resto del código para email/dni).
export const MODELOS_CON_EMPRESA = new Set([
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
 * Corazón del aislamiento multi-tenant: dado un modelo/operación/args de
 * Prisma, agrega (mutando in-place, como hace Prisma con sus args) el
 * filtro/dato `empresaId` que corresponda. Separada de `scopedPrisma` para
 * poder testearla directo, sin necesidad de un PrismaClient real — ver
 * lib/tenant-prisma.test.ts.
 */
export function aplicarScopeDeEmpresa(
  model: string | undefined,
  operation: string,
  // Los modelos varían (Empresa, PerfilChofer, etc. no tienen empresaId), así
  // que TypeScript no puede tipar `args` de forma estricta acá — el
  // `Set`/chequeo del caller ya garantiza en runtime que solo entran modelos
  // con empresaId.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any,
  empresaId: string
) {
  if (!model || !MODELOS_CON_EMPRESA.has(model)) {
    return args;
  }

  switch (operation) {
    case "findUnique":
    case "findUniqueOrThrow":
    case "update":
    case "delete":
      // La clave única queda en el nivel superior (cumple el tipo
      // WhereUniqueInput) y empresaId se agrega como filtro hermano —
      // mismo patrón que ya usa el resto del código
      // (ej. `where: { id, eliminadoEn: null }`).
      args.where = { ...args.where, empresaId };
      break;
    case "findFirst":
    case "findFirstOrThrow":
    case "findMany":
    case "updateMany":
    case "deleteMany":
    case "count":
    case "aggregate":
    case "groupBy":
      args.where = { ...(args.where ?? {}), empresaId };
      break;
    case "create":
      args.data = { ...args.data, empresaId };
      break;
    case "createMany":
    case "createManyAndReturn":
      args.data = Array.isArray(args.data)
        ? args.data.map((d: object) => ({ ...d, empresaId }))
        : { ...args.data, empresaId };
      break;
    case "upsert":
      args.where = { ...args.where, empresaId };
      args.create = { ...args.create, empresaId };
      args.update = { ...args.update, empresaId };
      break;
  }
  return args;
}

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
          return query(aplicarScopeDeEmpresa(model, operation, args, empresaId));
        },
      },
    },
  });
}

export type ScopedPrismaClient = ReturnType<typeof scopedPrisma>;
