import { BackButton } from "@/components/back-button";
import { EmpresaForm } from "./empresa-form";

export default function NuevaEmpresaPage() {
  return (
    <div className="space-y-6">
      <BackButton fallbackHref="/plataforma" />
      <div>
        <h1 className="text-2xl font-semibold">Nueva empresa</h1>
        <p className="text-sm text-muted-foreground">
          Se crea la empresa junto con su primer usuario ADMIN, que después gestiona su propio
          equipo y flota de forma independiente.
        </p>
      </div>
      <EmpresaForm />
    </div>
  );
}
