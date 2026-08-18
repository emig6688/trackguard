import { requireEmpresa } from "@/lib/permisos";
import { Badge } from "@/components/ui/badge";
import { RestaurarButton } from "@/components/restaurar-button";
import { listarPapelera, ETIQUETA_TIPO, resumenRegistro } from "@/lib/papelera";

export default async function PapeleraPage() {
  const { user, prisma } = await requireEmpresa(["ADMIN"]);

  const registros = await listarPapelera(prisma, user.empresaId!);

  const idsEliminadores = [
    ...new Set(registros.map((r) => r.registro.eliminadoPorId).filter(Boolean)),
  ] as string[];
  const eliminadores = await prisma.usuario.findMany({
    where: { id: { in: idsEliminadores }, empresaId: user.empresaId! },
    select: { id: true, nombre: true },
  });
  const eliminadorPorId = new Map(eliminadores.map((u) => [u.id, u.nombre]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Papelera</h1>
        <p className="text-sm text-muted-foreground">
          Todo lo eliminado en cualquier módulo queda acá, con quién lo borró y cuándo. Se puede
          restaurar en cualquier momento.
        </p>
      </div>

      <div className="space-y-2">
        {registros.map(({ tipo, registro }) => (
          <div
            key={`${tipo}-${registro.id}`}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3 text-sm"
          >
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{ETIQUETA_TIPO[tipo]}</Badge>
                <span className="font-medium">{resumenRegistro(tipo, registro)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Eliminado el {(registro.eliminadoEn as Date).toLocaleDateString("es-AR")}
                {registro.eliminadoPorId
                  ? ` por ${eliminadorPorId.get(registro.eliminadoPorId) ?? "usuario eliminado"}`
                  : ""}
              </p>
            </div>
            <RestaurarButton tipo={tipo} id={registro.id} />
          </div>
        ))}
        {registros.length === 0 && (
          <p className="text-sm text-muted-foreground">La papelera está vacía.</p>
        )}
      </div>
    </div>
  );
}
