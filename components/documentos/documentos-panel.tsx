import { requireEmpresa } from "@/lib/permisos";
import { Badge } from "@/components/ui/badge";
import { EliminarButton } from "@/components/eliminar-button";
import {
  calcularEstadoVencimiento,
  ESTADO_VENCIMIENTO_LABEL,
  ESTADO_VENCIMIENTO_VARIANT,
} from "@/lib/vencimientos";
import { DocumentoForm } from "./documento-form";

export async function DocumentosPanel({
  entidadTipo,
  entidadId,
  redirectPath,
}: {
  entidadTipo: "VEHICULO" | "CHOFER";
  entidadId: string;
  redirectPath: string;
}) {
  const { user, prisma } = await requireEmpresa();
  const [documentos, tiposDocumento] = await Promise.all([
    prisma.documento.findMany({
      where: { entidadTipo, entidadId, activo: true, eliminadoEn: null },
      include: { tipoDocumento: true },
      orderBy: { fechaVencimiento: "asc" },
    }),
    prisma.tipoDocumentoConfig.findMany({
      where: { activo: true, aplicaA: { in: [entidadTipo, "AMBOS"] } },
      orderBy: { nombre: "asc" },
    }),
  ]);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Documentación y habilitaciones</h2>

      <div className="space-y-2">
        {documentos.map((doc) => {
          const estado = calcularEstadoVencimiento(
            doc.fechaVencimiento,
            doc.tipoDocumento.diasAlertaDefault
          );
          return (
            <div
              key={doc.id}
              className="flex items-center justify-between rounded-lg border p-3 text-sm"
            >
              <div>
                <p className="font-medium">{doc.tipoDocumento.nombre}</p>
                <p className="text-muted-foreground">
                  Vence: {doc.fechaVencimiento.toLocaleDateString("es-AR")}
                  {doc.numeroDocumento ? ` · N° ${doc.numeroDocumento}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={ESTADO_VENCIMIENTO_VARIANT[estado]}>
                  {ESTADO_VENCIMIENTO_LABEL[estado]}
                </Badge>
                {user.rol === "ADMIN" && (
                  <EliminarButton tipo="documento" id={doc.id} redirectPath={redirectPath} />
                )}
              </div>
            </div>
          );
        })}
        {documentos.length === 0 && (
          <p className="text-sm text-muted-foreground">Sin documentos cargados.</p>
        )}
      </div>

      <DocumentoForm
        entidadTipo={entidadTipo}
        entidadId={entidadId}
        redirectPath={redirectPath}
        tiposDocumento={tiposDocumento}
      />
    </div>
  );
}
