import { requireEmpresa } from "@/lib/permisos";
import { OTForm } from "./ot-form";

export default async function NuevaOTPage() {
  const { user, prisma } = await requireEmpresa();
  const [vehiculos, mecanicos] = await Promise.all([
    prisma.vehiculo.findMany({ where: { activo: true, eliminadoEn: null }, orderBy: { patente: "asc" } }),
    prisma.usuario.findMany({
      where: { rol: "MECANICO_INTERNO", activo: true, eliminadoEn: null, empresaId: user.empresaId! },
    }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Nueva orden de trabajo</h1>
      <OTForm vehiculos={vehiculos} mecanicos={mecanicos} />
    </div>
  );
}
