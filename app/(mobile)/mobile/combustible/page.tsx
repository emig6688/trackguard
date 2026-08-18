import { requireEmpresa } from "@/lib/permisos";
import { CombustibleForm } from "./combustible-form";

export default async function CombustiblePage() {
  const { prisma } = await requireEmpresa();
  const vehiculos = await prisma.vehiculo.findMany({
    where: { activo: true, eliminadoEn: null },
    orderBy: { patente: "asc" },
  });

  return <CombustibleForm vehiculos={vehiculos} />;
}
