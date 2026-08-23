import type { Rol } from "@/app/generated/prisma/client";

/**
 * Página "de inicio" de cada rol — usada tanto por proxy.ts (para redirigir
 * ahí cuando alguien entra a una ruta que no le corresponde) como por el
 * login (para no depender de que el segundo salto de redirect de proxy.ts
 * corrija la URL: un redirect de "/" a esto disparado desde dentro de una
 * transición cliente de una Server Action no siempre actualiza la barra de
 * direcciones, aunque el contenido correcto sí se renderiza).
 */
export function homeForRol(rol: Rol): string {
  if (rol === "SUPERADMIN") return "/plataforma";
  if (rol === "CHOFER") return "/mobile/inicio";
  if (rol === "GUARDIA") return "/guardia";
  return "/dashboard";
}
