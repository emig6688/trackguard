import { NextResponse } from "next/server";
import { requireRole } from "@/lib/permisos";
import { eliminarRegistro } from "@/lib/papelera";
import { aplicarPlanEstandarAVehiculo } from "@/lib/plan-mantenimiento-estandar";

/**
 * Ruta temporal de un solo uso: borra (a papelera) los planes de
 * mantenimiento de un vehículo cuya fecha base quedó pisada desde las
 * pruebas iniciales, y reaplica el plan estándar con fecha de hoy. Se borra
 * después de usarse — no es una funcionalidad permanente.
 */
export async function POST(request: Request) {
  const { user, prisma } = await requireRole(["ADMIN"]);
  const { vehiculoId } = (await request.json()) as { vehiculoId: string };

  const planes = await prisma.planMantenimiento.findMany({
    where: { vehiculoId, activo: true, eliminadoEn: null },
    select: { id: true },
  });
  for (const plan of planes) {
    await eliminarRegistro(prisma, user.empresaId!, "planMantenimiento", plan.id, user.id);
  }
  const aplicados = await aplicarPlanEstandarAVehiculo(prisma, user.empresaId!, vehiculoId);

  return NextResponse.json({ eliminados: planes.length, aplicados });
}
