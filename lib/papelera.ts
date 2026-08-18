import "server-only";
import type { ScopedPrismaClient } from "@/lib/tenant-prisma";

export const TIPOS_PAPELERA = [
  "vehiculo",
  "usuario",
  "documento",
  "planMantenimiento",
  "planMantenimientoEstandarItem",
  "tallerExterno",
  "ordenDeTrabajo",
  "oTRepuesto",
  "factura",
  "articuloPanol",
  "ordenCompra",
  "cargaCombustible",
  "gasto",
] as const;

export type TipoPapelera = (typeof TIPOS_PAPELERA)[number];

export const ETIQUETA_TIPO: Record<TipoPapelera, string> = {
  vehiculo: "Vehículo",
  usuario: "Usuario / Chofer",
  documento: "Documento",
  planMantenimiento: "Plan de mantenimiento",
  planMantenimientoEstandarItem: "Ítem del catálogo estándar",
  tallerExterno: "Taller externo",
  ordenDeTrabajo: "Orden de trabajo",
  oTRepuesto: "Repuesto de OT",
  factura: "Factura",
  articuloPanol: "Artículo de pañol",
  ordenCompra: "Orden de compra",
  cargaCombustible: "Carga de combustible",
  gasto: "Gasto",
};

// La ruta a revalidar/refrescar cuando se elimina o restaura cada tipo, para
// que el listado correspondiente refleje el cambio de inmediato.
export const RUTA_LISTADO: Record<TipoPapelera, string> = {
  vehiculo: "/vehiculos",
  usuario: "/usuarios",
  documento: "/documentos",
  planMantenimiento: "/vehiculos",
  planMantenimientoEstandarItem: "/mantenimiento-estandar",
  tallerExterno: "/talleres-externos",
  ordenDeTrabajo: "/ordenes-trabajo",
  oTRepuesto: "/ordenes-trabajo",
  factura: "/ordenes-trabajo",
  articuloPanol: "/panol",
  ordenCompra: "/compras",
  cargaCombustible: "/combustible",
  gasto: "/gastos",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function delegate(prisma: ScopedPrismaClient, tipo: TipoPapelera): any {
  return prisma[tipo as keyof typeof prisma];
}

/**
 * "usuario" es el único tipo que el cliente scoped NO filtra automáticamente
 * (su empresaId es nullable, para permitir un SUPERADMIN sin empresa — ver
 * lib/tenant-prisma.ts), así que acá se agrega a mano para que un ADMIN de
 * una empresa no pueda borrar/restaurar/listar usuarios de otra.
 */
function whereConEmpresa(tipo: TipoPapelera, empresaId: string, where: Record<string, unknown>) {
  return tipo === "usuario" ? { ...where, empresaId } : where;
}

// "ordenCompra" es cabecera de OrdenCompraItem: para resumirla en el listado
// de papelera hace falta traer los ítems, no solo la fila de la cabecera.
const INCLUDE_PAPELERA: Partial<Record<TipoPapelera, Record<string, boolean>>> = {
  ordenCompra: { items: true },
};

export async function eliminarRegistro(
  prisma: ScopedPrismaClient,
  empresaId: string,
  tipo: TipoPapelera,
  id: string,
  eliminadoPorId: string
) {
  await delegate(prisma, tipo).update({
    where: whereConEmpresa(tipo, empresaId, { id }),
    data: { eliminadoEn: new Date(), eliminadoPorId },
  });
}

export async function restaurarRegistro(
  prisma: ScopedPrismaClient,
  empresaId: string,
  tipo: TipoPapelera,
  id: string
) {
  await delegate(prisma, tipo).update({
    where: whereConEmpresa(tipo, empresaId, { id }),
    data: { eliminadoEn: null, eliminadoPorId: null },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RegistroPapelera = { tipo: TipoPapelera; registro: any };

export async function listarPapelera(
  prisma: ScopedPrismaClient,
  empresaId: string
): Promise<RegistroPapelera[]> {
  const listas = await Promise.all(
    TIPOS_PAPELERA.map(async (tipo) => {
      const registros = await delegate(prisma, tipo).findMany({
        where: whereConEmpresa(tipo, empresaId, { eliminadoEn: { not: null } }),
        include: INCLUDE_PAPELERA[tipo],
        orderBy: { eliminadoEn: "desc" },
      });
      return registros.map((registro: unknown) => ({ tipo, registro }));
    })
  );
  const todos = listas.flat();
  todos.sort(
    (a, b) => (b.registro.eliminadoEn as Date).getTime() - (a.registro.eliminadoEn as Date).getTime()
  );
  return todos;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function resumenRegistro(tipo: TipoPapelera, registro: any): string {
  switch (tipo) {
    case "vehiculo":
      return `${registro.patente} — ${registro.marca} ${registro.modelo}`;
    case "usuario":
      return `${registro.nombre} (${registro.email})`;
    case "documento": {
      const numero = registro.numeroDocumento ? ` N° ${registro.numeroDocumento}` : "";
      const vencimiento = registro.fechaVencimiento
        ? ` · vencía el ${(registro.fechaVencimiento as Date).toLocaleDateString("es-AR")}`
        : "";
      return `Documento${numero}${vencimiento}`;
    }
    case "planMantenimiento":
      return registro.nombre;
    case "planMantenimientoEstandarItem":
      return `${registro.categoria} — ${registro.nombre}`;
    case "tallerExterno":
      return registro.nombre;
    case "ordenDeTrabajo":
      return `${registro.numero} — ${registro.titulo}`;
    case "oTRepuesto":
      return `${registro.cantidad}x ${registro.descripcion}`;
    case "factura":
      return `Factura $${registro.monto}`;
    case "articuloPanol":
      return registro.nombre;
    case "ordenCompra": {
      const items = (registro.items as { descripcion: string }[]) ?? [];
      const resto = items.length > 1 ? ` y ${items.length - 1} más` : "";
      return `${registro.numero} — ${items[0]?.descripcion ?? ""}${resto}`;
    }
    case "cargaCombustible":
      return `Carga de ${registro.litrosCargados} L`;
    case "gasto":
      return `Gasto ${registro.tipo} — $${registro.monto}`;
    default:
      return registro.id;
  }
}
