import { notFound } from "next/navigation";
import Link from "next/link";
import { requireEmpresa } from "@/lib/permisos";
import { actualizarArticuloPanol } from "@/app/_actions/panol";
import { BackButton } from "@/components/back-button";
import { EliminarButton } from "@/components/eliminar-button";
import { Badge } from "@/components/ui/badge";
import { ArticuloForm } from "../articulo-form";

const ESTADO_LABEL: Record<string, string> = {
  PENDIENTE: "Pendiente",
  REALIZADA: "Realizada",
  CANCELADA: "Cancelada",
};

const ESTADO_VARIANT: Record<string, "success" | "warning" | "destructive"> = {
  PENDIENTE: "warning",
  REALIZADA: "success",
  CANCELADA: "destructive",
};

export default async function ArticuloDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user: session, prisma } = await requireEmpresa();
  const articulo = await prisma.articuloPanol.findUnique({
    where: { id, eliminadoEn: null },
    include: {
      itemsOrdenCompra: {
        where: { ordenCompra: { eliminadoEn: null } },
        include: { ordenCompra: true },
        orderBy: { ordenCompra: { createdAt: "desc" } },
      },
    },
  });
  if (!articulo) notFound();

  const actualizarConId = actualizarArticuloPanol.bind(null, articulo.id);

  return (
    <div className="space-y-10">
      <BackButton fallbackHref="/panol" />
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">{articulo.nombre}</h1>
          {session.rol === "ADMIN" && (
            <EliminarButton tipo="articuloPanol" id={articulo.id} redirectPath="/panol" />
          )}
        </div>
        <ArticuloForm
          action={actualizarConId}
          defaultValues={{
            nombre: articulo.nombre,
            descripcion: articulo.descripcion,
            unidadMedida: articulo.unidadMedida,
            stockActual: articulo.stockActual,
            stockMinimo: articulo.stockMinimo,
          }}
          submitLabel="Guardar cambios"
        />
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Órdenes de compra de este artículo</h2>
        <div className="space-y-2">
          {articulo.itemsOrdenCompra.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
              <Link href={`/compras`} className="min-w-0 hover:underline">
                {item.ordenCompra.numero} — {item.descripcion}
              </Link>
              <Badge variant={ESTADO_VARIANT[item.ordenCompra.estado]}>
                {ESTADO_LABEL[item.ordenCompra.estado]}
              </Badge>
            </div>
          ))}
          {articulo.itemsOrdenCompra.length === 0 && (
            <p className="text-sm text-muted-foreground">Sin órdenes de compra para este artículo.</p>
          )}
        </div>
      </div>
    </div>
  );
}
