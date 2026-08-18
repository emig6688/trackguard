import { crearUsuario } from "@/app/_actions/usuarios";
import { UsuarioForm } from "./usuario-form";

export default function NuevoUsuarioPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Nuevo usuario</h1>
      <UsuarioForm action={crearUsuario} modo="crear" submitLabel="Crear usuario" />
    </div>
  );
}
