import "server-only";
import type { Prisma } from "@/app/generated/prisma/client";

/**
 * El vehículo/chofer de una OC no es un campo propio: se llega vía la OT
 * asignada (OrdenCompra.ordenDeTrabajo) y, para el chofer, vía quien generó
 * esa OT (checklist pre-salida o evento de ruta) — no hay chofer asignado
 * fijo a un vehículo. Se reusa tanto en el listado de /compras como en el
 * export a Excel para que ambos filtren exactamente igual.
 */
export function construirCondicionOTCompra({
  vehiculoId,
  choferId,
}: {
  vehiculoId?: string;
  choferId?: string;
}): Prisma.OrdenDeTrabajoWhereInput {
  const condicion: Prisma.OrdenDeTrabajoWhereInput = {};
  if (vehiculoId) condicion.vehiculoId = vehiculoId;
  if (choferId) {
    condicion.OR = [
      { checklistRealizado: { choferId } },
      { eventoRuta: { choferId } },
    ];
  }
  return condicion;
}
