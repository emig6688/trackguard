import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireSession } from "@/lib/permisos";
import { ReporteOCDocument } from "@/lib/pdf/reporte-oc";

export const maxDuration = 60;

export async function GET(request: Request) {
  const { prisma } = await requireSession();

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta el id de la compra" }, { status: 400 });

  const compra = await prisma.ordenCompra.findUnique({
    where: { id, eliminadoEn: null },
    include: {
      creadoPor: true,
      ordenDeTrabajo: true,
      items: true,
      autorizadoPor: true,
      presupuestos: { include: { subidoPor: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!compra) return NextResponse.json({ error: "Compra no encontrada" }, { status: 404 });

  const buffer = await renderToBuffer(
    <ReporteOCDocument
      compra={{
        numero: compra.numero,
        items: compra.items.map((i) => ({
          descripcion: i.descripcion,
          cantidadSolicitada: i.cantidadSolicitada,
          cantidadRecibida: i.cantidadRecibida,
        })),
        origen: compra.origen,
        estado: compra.estado,
        creadoPorNombre: compra.creadoPor?.nombre ?? null,
        fechaSolicitud: compra.fechaSolicitud,
        fechaCompra: compra.fechaCompra,
        montoEstimado: compra.montoEstimado?.toString() ?? null,
        montoTotal: compra.montoTotal?.toString() ?? null,
        observaciones: compra.observaciones,
        ordenDeTrabajoNumero: compra.ordenDeTrabajo?.numero ?? null,
        estadoAutorizacion: compra.estadoAutorizacion,
        autorizadoPorNombre: compra.autorizadoPor?.nombre ?? null,
        autorizadoEn: compra.autorizadoEn,
        presupuestos: compra.presupuestos.map((p) => ({
          id: p.id,
          proveedor: p.proveedor,
          monto: p.monto?.toString() ?? null,
          subidoPorNombre: p.subidoPor.nombre,
          aprobado: p.id === compra.presupuestoAprobadoId,
        })),
      }}
    />
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${compra.numero}.pdf"`,
    },
  });
}
