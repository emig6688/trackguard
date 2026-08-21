import Link from "next/link";
import { requireEmpresa, ROLES_GUARDIA } from "@/lib/permisos";
import { buttonVariants } from "@/components/ui/button";

export default async function DevolucionesPage() {
  const { prisma } = await requireEmpresa(ROLES_GUARDIA);

  const devoluciones = await prisma.devolucion.findMany({
    include: {
      chofer: true,
      _count: { select: { productos: true, cambios: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Devoluciones</h1>
          <p className="text-sm text-muted-foreground">Últimas devoluciones registradas.</p>
        </div>
        <Link href="/guardia/devoluciones/nueva" className={buttonVariants()}>
          Nueva devolución
        </Link>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="p-3 font-medium">Fecha</th>
              <th className="p-3 font-medium">Chofer</th>
              <th className="p-3 font-medium">Cliente</th>
              <th className="p-3 font-medium">Remito</th>
              <th className="p-3 font-medium">Productos</th>
              <th className="p-3 font-medium">Cambios</th>
            </tr>
          </thead>
          <tbody>
            {devoluciones.map((d) => (
              <tr key={d.id} className="border-t hover:bg-accent">
                <td className="p-3">
                  <Link href={`/guardia/devoluciones/${d.id}`} className="block hover:underline">
                    {d.fecha.toLocaleDateString("es-AR", { timeZone: "UTC" })}
                  </Link>
                </td>
                <td className="p-3">{d.chofer.nombre}</td>
                <td className="p-3">{d.cliente}</td>
                <td className="p-3">{d.remito}</td>
                <td className="p-3">{d._count.productos}</td>
                <td className="p-3">{d._count.cambios}</td>
              </tr>
            ))}
            {devoluciones.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  Todavía no hay devoluciones cargadas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
