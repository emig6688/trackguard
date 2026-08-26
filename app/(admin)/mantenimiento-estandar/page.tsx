import { requireEmpresa } from "@/lib/permisos";
import { BackToDashboard } from "@/components/back-to-dashboard";
import { ItemCatalogoForm } from "@/components/planes-mantenimiento/item-catalogo-form";
import { ItemCatalogoRow } from "@/components/planes-mantenimiento/item-catalogo-row";
import { AplicarFlotaDialog } from "@/components/planes-mantenimiento/aplicar-flota-dialog";
import { CargarCatalogoEstandarButton } from "@/components/planes-mantenimiento/cargar-catalogo-estandar-button";

export default async function MantenimientoEstandarPage() {
  const { prisma } = await requireEmpresa();
  const [items, vehiculos] = await Promise.all([
    prisma.planMantenimientoEstandarItem.findMany({
      where: { eliminadoEn: null },
      orderBy: [{ categoria: "asc" }, { nombre: "asc" }],
    }),
    prisma.vehiculo.findMany({
      where: { activo: true, eliminadoEn: null },
      select: { id: true, patente: true, marca: true, modelo: true },
      orderBy: { patente: "asc" },
    }),
  ]);

  const categorias = new Map<string, typeof items>();
  for (const item of items) {
    categorias.set(item.categoria, [...(categorias.get(item.categoria) ?? []), item]);
  }

  return (
    <div className="space-y-6">
      <BackToDashboard />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Mantenimiento preventivo estándar</h1>
          <p className="text-sm text-muted-foreground">
            Catálogo que se aplica automáticamente a cada vehículo nuevo. Editar, desactivar o eliminar
            una tarea acá no afecta lo ya cargado en los vehículos existentes — usá &quot;Aplicar plan
            estándar&quot; desde la ficha del vehículo, o &quot;Aplicar a flota&quot; para hacerlo de forma
            masiva.
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <CargarCatalogoEstandarButton />
          <AplicarFlotaDialog vehiculos={vehiculos} />
        </div>
      </div>

      <div className="space-y-6">
        {[...categorias.entries()].map(([categoria, itemsCategoria]) => (
          <div key={categoria} className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {categoria}
            </p>
            <div className="space-y-2">
              {itemsCategoria.map((item) => (
                <ItemCatalogoRow key={item.id} item={item} />
              ))}
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground">Sin tareas cargadas en el catálogo estándar.</p>
        )}
      </div>

      <ItemCatalogoForm />
    </div>
  );
}
