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
          <p className="text-xs text-muted-foreground">
            Estas devoluciones (junto con el control de portería) se envían automáticamente todos
            los días a las 23:00 (hora Argentina), por el medio configurado en Mantenedor →
            Parámetros — no hace falta enviarlas a mano.
          </p>
        </div>
        <Link href="/guardia/devoluciones/nueva" className={buttonVariants()}>
          Nueva devolución
        </Link>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="max-w-[110px] p-3 font-medium md:max-w-none">Fecha</th>
              <th className="hidden p-3 font-medium md:table-cell">Chofer</th>
              <th className="hidden p-3 font-medium md:table-cell">Cliente</th>
              <th className="p-3 font-medium">Remito</th>
              <th className="hidden p-3 font-medium md:table-cell">Productos</th>
              <th className="hidden p-3 font-medium md:table-cell">Cambios</th>
            </tr>
          </thead>
          <tbody>
            {devoluciones.map((d) => (
              <tr key={d.id} className="border-t hover:bg-accent">
                <td className="max-w-[110px] whitespace-normal p-3 md:max-w-none md:whitespace-nowrap">
                  <Link href={`/guardia/devoluciones/${d.id}`} className="block hover:underline">
                    {d.fecha.toLocaleDateString("es-AR", { timeZone: "UTC" })}
                  </Link>
                  <p className="text-xs text-muted-foreground md:hidden">
                    {d.chofer.nombre} · {d.cliente}
                  </p>
                </td>
                <td className="hidden p-3 md:table-cell">{d.chofer.nombre}</td>
                <td className="hidden p-3 md:table-cell">{d.cliente}</td>
                <td className="p-3">
                  {d.remito}
                  <p className="text-xs text-muted-foreground md:hidden">
                    {d._count.productos} productos · {d._count.cambios} cambios
                  </p>
                </td>
                <td className="hidden p-3 md:table-cell">{d._count.productos}</td>
                <td className="hidden p-3 md:table-cell">{d._count.cambios}</td>
              </tr>
            ))}
            {devoluciones.length === 0 && (
              <tr>
                <td colSpan={6} className="whitespace-normal p-6 text-center text-muted-foreground">
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
