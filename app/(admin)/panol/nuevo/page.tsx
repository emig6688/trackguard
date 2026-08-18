import { crearArticuloPanol } from "@/app/_actions/panol";
import { BackButton } from "@/components/back-button";
import { ArticuloForm } from "../articulo-form";

export default function NuevoArticuloPage() {
  return (
    <div className="space-y-6">
      <BackButton fallbackHref="/panol" />
      <h1 className="text-2xl font-semibold">Nuevo artículo</h1>
      <ArticuloForm action={crearArticuloPanol} submitLabel="Crear artículo" />
    </div>
  );
}
