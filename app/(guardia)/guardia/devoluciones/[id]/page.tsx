import { notFound } from "next/navigation";
import { requireEmpresa, ROLES_GUARDIA } from "@/lib/permisos";
import { formatearFechaHora } from "@/lib/fecha";
import { BackButton } from "@/components/back-button";

export default async function DevolucionDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { prisma } = await requireEmpresa(ROLES_GUARDIA);

  const devolucion = await prisma.devolucion.findUnique({
    where: { id },
    include: {
      chofer: true,
      registradoPor: true,
      productos: true,
      cambios: true,
    },
  });
  if (!devolucion) notFound();

  return (
    <div className="max-w-3xl space-y-8">
      <BackButton fallbackHref="/guardia/devoluciones" />

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-semibold">1. Devoluciones</h2>
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <p>
            <span className="text-muted-foreground">Fecha:</span>{" "}
            {devolucion.fecha.toLocaleDateString("es-AR", { timeZone: "UTC" })}
          </p>
          <p>
            <span className="text-muted-foreground">Chofer:</span> {devolucion.chofer.nombre}
          </p>
          <p>
            <span className="text-muted-foreground">Cliente:</span> {devolucion.cliente}
          </p>
          <p>
            <span className="text-muted-foreground">Remito:</span> {devolucion.remito}
          </p>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-semibold">2. Regresa a frigorífico</h2>
        {devolucion.productos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin productos cargados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="p-2 font-medium">Producto</th>
                  <th className="p-2 font-medium">Correlativo</th>
                  <th className="p-2 font-medium">Ubicación guardado</th>
                  <th className="p-2 font-medium">Observación</th>
                </tr>
              </thead>
              <tbody>
                {devolucion.productos.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="p-2">{p.producto}</td>
                    <td className="p-2">{p.correlativo}</td>
                    <td className="p-2">{p.ubicacionGuardado}</td>
                    <td className="p-2 text-muted-foreground">{p.observacion || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-semibold">3. Cambios</h2>
        {devolucion.cambios.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin cambios cargados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="p-2 font-medium">Cliente al que se entregó</th>
                  <th className="p-2 font-medium">Producto</th>
                  <th className="p-2 font-medium">Correlativo</th>
                  <th className="p-2 font-medium">Autoriz.</th>
                  <th className="p-2 font-medium">Observación</th>
                </tr>
              </thead>
              <tbody>
                {devolucion.cambios.map((c) => (
                  <tr key={c.id} className="border-t">
                    <td className="p-2">{c.clienteEntregado}</td>
                    <td className="p-2">{c.producto}</td>
                    <td className="p-2">{c.correlativo}</td>
                    <td className="p-2">{c.autoriz}</td>
                    <td className="p-2 text-muted-foreground">{c.observacion || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-xs text-muted-foreground">
        Registrado por {devolucion.registradoPor.nombre} el{" "}
        {formatearFechaHora(devolucion.createdAt)}
      </p>
    </div>
  );
}
