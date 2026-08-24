import Link from "next/link";
import { requireEmpresa } from "@/lib/permisos";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EliminarButton } from "@/components/eliminar-button";
import { BackToDashboard } from "@/components/back-to-dashboard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  calcularEstadoVencimiento,
  ESTADO_VENCIMIENTO_LABEL,
  ESTADO_VENCIMIENTO_VARIANT,
  type EstadoVencimiento,
} from "@/lib/vencimientos";

export default async function DocumentosPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; tipo?: string }>;
}) {
  const { estado: filtroEstado, tipo: filtroTipo } = await searchParams;
  const { user, prisma } = await requireEmpresa();

  const [documentos, tiposDocumento] = await Promise.all([
    prisma.documento.findMany({
      where: {
        activo: true,
        eliminadoEn: null,
        ...(filtroTipo ? { tipoDocumento: { nombre: { equals: filtroTipo, mode: "insensitive" } } } : {}),
      },
      include: { tipoDocumento: true },
      orderBy: { fechaVencimiento: "asc" },
    }),
    prisma.tipoDocumentoConfig.findMany({ orderBy: { nombre: "asc" } }),
  ]);

  const vehiculoIds = documentos
    .filter((d) => d.entidadTipo === "VEHICULO")
    .map((d) => d.entidadId);
  const choferIds = documentos.filter((d) => d.entidadTipo === "CHOFER").map((d) => d.entidadId);

  const [vehiculos, choferes] = await Promise.all([
    prisma.vehiculo.findMany({ where: { id: { in: vehiculoIds }, eliminadoEn: null } }),
    prisma.usuario.findMany({
      where: { id: { in: choferIds }, eliminadoEn: null, empresaId: user.empresaId! },
    }),
  ]);

  const vehiculoPorId = new Map(vehiculos.map((v) => [v.id, v]));
  const choferPorId = new Map(choferes.map((c) => [c.id, c]));

  const filas = documentos.map((doc) => {
    const estado = calcularEstadoVencimiento(
      doc.fechaVencimiento,
      doc.tipoDocumento.diasAlertaDefault
    );
    const entidadLabel =
      doc.entidadTipo === "VEHICULO"
        ? vehiculoPorId.get(doc.entidadId)?.patente ?? "Vehículo eliminado"
        : choferPorId.get(doc.entidadId)?.nombre ?? "Chofer eliminado";
    const entidadHref =
      doc.entidadTipo === "VEHICULO"
        ? `/vehiculos/${doc.entidadId}`
        : `/choferes/${doc.entidadId}`;

    return { doc, estado, entidadLabel, entidadHref };
  });

  const filasFiltradas = filtroEstado
    ? filas.filter((f) => f.estado === filtroEstado)
    : filas;

  const conteos: Record<EstadoVencimiento, number> = {
    VENCIDO: filas.filter((f) => f.estado === "VENCIDO").length,
    PROXIMO: filas.filter((f) => f.estado === "PROXIMO").length,
    VIGENTE: filas.filter((f) => f.estado === "VIGENTE").length,
  };

  const construirHrefEstado = (estado: EstadoVencimiento) => {
    const query = new URLSearchParams();
    if (filtroEstado !== estado) query.set("estado", estado);
    if (filtroTipo) query.set("tipo", filtroTipo);
    const queryString = query.toString();
    return queryString ? `/documentos?${queryString}` : "/documentos";
  };

  const queryExport = new URLSearchParams();
  if (filtroEstado) queryExport.set("estado", filtroEstado);
  if (filtroTipo) queryExport.set("tipo", filtroTipo);
  const queryExportString = queryExport.toString();

  return (
    <div className="space-y-6">
      <BackToDashboard />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Vencimientos de documentación</h1>
        <div className="flex gap-2">
          <a
            href={`/api/export/vencimientos-pdf${queryExportString ? `?${queryExportString}` : ""}`}
            className={buttonVariants({ variant: "outline" })}
          >
            Exportar PDF
          </a>
          <a
            href={`/api/export/vencimientos${queryExportString ? `?${queryExportString}` : ""}`}
            className={buttonVariants({ variant: "outline" })}
          >
            Exportar Excel
          </a>
        </div>
      </div>

      <form className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor="tipo">Tipo de documento</Label>
          <Input
            id="tipo"
            name="tipo"
            list="tipos-documento"
            defaultValue={filtroTipo}
            placeholder="Ej: ITV, SENASA, Licencia..."
            className="w-40 sm:w-64"
          />
          <datalist id="tipos-documento">
            {tiposDocumento.map((t) => (
              <option key={t.id} value={t.nombre} />
            ))}
          </datalist>
        </div>
        {filtroEstado && <input type="hidden" name="estado" value={filtroEstado} />}
        <Button type="submit" variant="outline" size="sm">
          Filtrar
        </Button>
        {(filtroTipo || filtroEstado) && (
          <Link href="/documentos" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            Limpiar filtros
          </Link>
        )}
      </form>

      <div className="flex flex-wrap gap-2">
        {(["VENCIDO", "PROXIMO", "VIGENTE"] as const).map((estado) => (
          <Link key={estado} href={construirHrefEstado(estado)}>
            <Badge
              variant={filtroEstado === estado ? ESTADO_VENCIMIENTO_VARIANT[estado] : "outline"}
            >
              {ESTADO_VENCIMIENTO_LABEL[estado]} ({conteos[estado]})
            </Badge>
          </Link>
        ))}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Entidad</TableHead>
            <TableHead className="hidden md:table-cell">Tipo</TableHead>
            <TableHead className="hidden md:table-cell">Vencimiento</TableHead>
            <TableHead>Estado</TableHead>
            {user.rol === "ADMIN" && <TableHead className="hidden md:table-cell">Acciones</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filasFiltradas.map(({ doc, estado, entidadLabel, entidadHref }) => (
            <TableRow key={doc.id}>
              <TableCell className="max-w-[150px] whitespace-normal md:max-w-none md:whitespace-nowrap">
                <Link href={entidadHref} className="font-medium hover:underline">
                  {entidadLabel}
                </Link>
                <p className="text-xs text-muted-foreground md:hidden">
                  {doc.tipoDocumento.nombre} · vence {doc.fechaVencimiento.toLocaleDateString("es-AR")}
                </p>
              </TableCell>
              <TableCell className="hidden md:table-cell">{doc.tipoDocumento.nombre}</TableCell>
              <TableCell className="hidden md:table-cell">{doc.fechaVencimiento.toLocaleDateString("es-AR")}</TableCell>
              <TableCell>
                <div className="flex flex-col items-start gap-1">
                  <Badge variant={ESTADO_VENCIMIENTO_VARIANT[estado]}>
                    {ESTADO_VENCIMIENTO_LABEL[estado]}
                  </Badge>
                  {user.rol === "ADMIN" && (
                    <span className="md:hidden">
                      <EliminarButton tipo="documento" id={doc.id} redirectPath="/documentos" />
                    </span>
                  )}
                </div>
              </TableCell>
              {user.rol === "ADMIN" && (
                <TableCell className="hidden md:table-cell">
                  <EliminarButton tipo="documento" id={doc.id} redirectPath="/documentos" />
                </TableCell>
              )}
            </TableRow>
          ))}
          {filasFiltradas.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="whitespace-normal text-center text-muted-foreground">
                No hay documentos para mostrar.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
