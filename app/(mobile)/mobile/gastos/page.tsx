import { requireEmpresa } from "@/lib/permisos";
import { GastoForm } from "./gasto-form";

export default async function GastosPage() {
  const { prisma } = await requireEmpresa();
  const vehiculos = await prisma.vehiculo.findMany({
    where: { activo: true, eliminadoEn: null },
    orderBy: { patente: "asc" },
  });

  return <GastoForm vehiculos={vehiculos} />;
}
