import { requireEmpresa, ROLES_GUARDIA } from "@/lib/permisos";
import { DevolucionForm } from "./devolucion-form";

export default async function NuevaDevolucionPage() {
  const { prisma } = await requireEmpresa(ROLES_GUARDIA);

  const choferes = await prisma.usuario.findMany({
    where: { rol: "CHOFER", activo: true, eliminadoEn: null },
    orderBy: { nombre: "asc" },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Nueva devolución</h1>
      <DevolucionForm choferes={choferes.map((c) => ({ id: c.id, nombre: c.nombre }))} />
    </div>
  );
}
