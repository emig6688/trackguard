import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { atajosPeriodo } from "@/lib/rango-fecha";

/**
 * Atajos "última semana / último mes / último año" para cualquier filtro de
 * período desde/hasta de la app — arma el link preservando el resto de los
 * parámetros ya presentes en la URL (tab, choferId, vehículo, etc.).
 */
export function FiltroPeriodoAtajos({
  basePath,
  params,
  paramDesde = "desde",
  paramHasta = "hasta",
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  paramDesde?: string;
  paramHasta?: string;
}) {
  const atajos = atajosPeriodo();
  return (
    <div className="flex flex-wrap items-center gap-2">
      {atajos.map((a) => {
        const query = new URLSearchParams();
        for (const [clave, valor] of Object.entries(params)) {
          if (valor && clave !== paramDesde && clave !== paramHasta) query.set(clave, valor);
        }
        query.set(paramDesde, a.desde);
        query.set(paramHasta, a.hasta);
        return (
          <Link key={a.label} href={`${basePath}?${query.toString()}`}>
            <Badge variant="outline">{a.label}</Badge>
          </Link>
        );
      })}
    </div>
  );
}
