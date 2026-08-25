import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireEmpresa, ROLES_ADMIN_MANTENIMIENTO } from "@/lib/permisos";
import { ImportarSeccion } from "./importar-seccion";
import {
  importarPanolExcel,
  importarVehiculosExcel,
  importarChoferesExcel,
} from "@/app/_actions/importar";

export default async function ImportarPage() {
  await requireEmpresa(ROLES_ADMIN_MANTENIMIENTO);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Importar datos</h1>
        <p className="text-sm text-muted-foreground">
          Cargá pañol, vehículos o choferes de forma masiva desde una planilla Excel. Descargá la
          plantilla de cada sección, completala y subila — las filas válidas se crean, las que
          tengan un error se reportan sin frenar el resto.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pañol</CardTitle>
        </CardHeader>
        <CardContent>
          <ImportarSeccion
            titulo="panol"
            descripcion="Alta masiva de artículos de pañol: nombre, descripción, unidad de medida y stock inicial."
            plantillaHref="/api/export/plantilla-panol"
            action={importarPanolExcel}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vehículos</CardTitle>
        </CardHeader>
        <CardContent>
          <ImportarSeccion
            titulo="vehiculos"
            descripcion="Alta masiva de vehículos. Al crearse, cada uno recibe automáticamente el plan de mantenimiento preventivo estándar, igual que en el alta individual."
            plantillaHref="/api/export/plantilla-vehiculos"
            action={importarVehiculosExcel}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Choferes</CardTitle>
        </CardHeader>
        <CardContent>
          <ImportarSeccion
            titulo="choferes"
            descripcion="Alta masiva de choferes. Cada fila necesita una contraseña inicial: el chofer puede cambiarla después de iniciar sesión."
            plantillaHref="/api/export/plantilla-choferes"
            action={importarChoferesExcel}
          />
        </CardContent>
      </Card>
    </div>
  );
}
