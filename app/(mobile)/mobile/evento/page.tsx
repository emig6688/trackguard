import { requireEmpresa } from "@/lib/permisos";
import { EventoForm } from "./evento-form";

export default async function EventoPage() {
  const { prisma } = await requireEmpresa();
  const vehiculos = await prisma.vehiculo.findMany({
    where: { activo: true, eliminadoEn: null },
    orderBy: { patente: "asc" },
  });

  return <EventoForm vehiculos={vehiculos} />;
}
