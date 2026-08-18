import { requireEmpresa } from "@/lib/permisos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { registrarChecklist } from "@/app/_actions/checklists";

export default async function ChecklistPage() {
  const { prisma } = await requireEmpresa();
  const [vehiculos, template] = await Promise.all([
    prisma.vehiculo.findMany({ where: { activo: true, eliminadoEn: null }, orderBy: { patente: "asc" } }),
    prisma.checklistTemplate.findFirst({
      where: { activo: true },
      include: { items: { orderBy: { orden: "asc" } } },
    }),
  ]);

  if (!template) {
    return <p className="text-sm text-muted-foreground">No hay un checklist configurado todavía.</p>;
  }

  return (
    <form action={registrarChecklist} className="space-y-6">
      <h1 className="text-lg font-semibold">Checklist pre-salida</h1>

      <input type="hidden" name="templateId" value={template.id} />

      <div className="space-y-2">
        <Label htmlFor="vehiculoId">Vehículo</Label>
        <select
          id="vehiculoId"
          name="vehiculoId"
          required
          className="w-full rounded-md border border-input bg-transparent p-2 text-sm"
        >
          <option value="">Elegí un vehículo</option>
          {vehiculos.map((v) => (
            <option key={v.id} value={v.id}>
              {v.patente}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="kmAlMomento">Km actual (opcional)</Label>
        <Input id="kmAlMomento" name="kmAlMomento" type="number" inputMode="numeric" />
      </div>

      <div className="space-y-4">
        {template.items.map((item) => (
          <fieldset key={item.id} className="space-y-2 rounded-lg border p-3">
            <legend className="px-1 text-sm font-medium">{item.texto}</legend>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-1">
                <input type="radio" name={`resultado_${item.id}`} value="OK" defaultChecked />
                OK
              </label>
              <label className="flex items-center gap-1">
                <input type="radio" name={`resultado_${item.id}`} value="FALLA" />
                Falla
              </label>
              <label className="flex items-center gap-1">
                <input type="radio" name={`resultado_${item.id}`} value="NO_APLICA" />
                N/A
              </label>
            </div>
            <Textarea
              name={`observacion_${item.id}`}
              placeholder="Observación (opcional)"
              className="text-sm"
            />
          </fieldset>
        ))}
      </div>

      <Button type="submit" className="w-full">
        Enviar checklist
      </Button>
    </form>
  );
}
