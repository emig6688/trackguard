import { NextResponse } from "next/server";
import { requireSuperadmin } from "@/lib/permisos";

/**
 * Ruta temporal de un solo uso — borra toda la info operativa (OT,
 * checklists, cierres de ruta, combustible, gastos, compras) de TODAS las
 * empresas para arrancar en limpio en producción. Se borra del código
 * después de usarse.
 */
export async function POST() {
  const { user, prisma } = await requireSuperadmin();

  // 1. Desvincula las OT de su checklist/evento de origen antes de borrar
  // esos dos — evita romper la foreign key.
  await prisma.ordenDeTrabajo.updateMany({
    data: { eventoRutaId: null, checklistRealizadoId: null },
  });

  // 2. Papelera (recuperable) para lo que ya la soporta.
  const ahora = new Date();
  const eliminadoPorId = user.id;
  const [ot, repuestos, facturas, compras, combustible, gastos] = await Promise.all([
    prisma.ordenDeTrabajo.updateMany({
      where: { eliminadoEn: null },
      data: { eliminadoEn: ahora, eliminadoPorId },
    }),
    prisma.oTRepuesto.updateMany({
      where: { eliminadoEn: null },
      data: { eliminadoEn: ahora, eliminadoPorId },
    }),
    prisma.factura.updateMany({
      where: { eliminadoEn: null },
      data: { eliminadoEn: ahora, eliminadoPorId },
    }),
    prisma.ordenCompra.updateMany({
      where: { eliminadoEn: null },
      data: { eliminadoEn: ahora, eliminadoPorId },
    }),
    prisma.cargaCombustible.updateMany({
      where: { eliminadoEn: null },
      data: { eliminadoEn: ahora, eliminadoPorId },
    }),
    prisma.gasto.updateMany({
      where: { eliminadoEn: null },
      data: { eliminadoEn: ahora, eliminadoPorId },
    }),
  ]);

  // 3. Borrado definitivo de lo que no tiene papelera.
  const [checklists, eventos, snapshots, fallos] = await Promise.all([
    prisma.checklistRealizado.deleteMany({}),
    prisma.eventoRuta.deleteMany({}),
    prisma.disponibilidadSnapshot.deleteMany({}),
    prisma.notificacionFallo.deleteMany({}),
  ]);

  // 4. Resetea la línea base de cada plan de mantenimiento al km/horas
  // actual real de su vehículo — Vehiculo.kmActual/horasEquipoFrio NO se
  // tocan.
  const vehiculos = await prisma.vehiculo.findMany({
    select: { id: true, kmActual: true, horasEquipoFrio: true },
  });
  let planesActualizados = 0;
  for (const v of vehiculos) {
    const r = await prisma.planMantenimiento.updateMany({
      where: { vehiculoId: v.id, activo: true, eliminadoEn: null },
      data: { kmUltimoService: v.kmActual, horasUltimoService: v.horasEquipoFrio, fechaUltimoService: ahora },
    });
    planesActualizados += r.count;
  }

  return NextResponse.json({
    papelera: {
      ordenesDeTrabajo: ot.count,
      repuestos: repuestos.count,
      facturas: facturas.count,
      compras: compras.count,
      combustible: combustible.count,
      gastos: gastos.count,
    },
    borradoDefinitivo: {
      checklists: checklists.count,
      eventosRuta: eventos.count,
      snapshotsDisponibilidad: snapshots.count,
      notificacionesFallo: fallos.count,
    },
    vehiculos: vehiculos.length,
    planesActualizados,
  });
}
