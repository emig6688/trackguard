import type { Rol } from "@/app/generated/prisma/client";

// Record exhaustivo: si se agrega un rol nuevo al enum Rol de schema.prisma,
// TypeScript exige agregarlo acá antes de poder compilar — así todo lo que
// se deriva de este mapa (selector de roles en notificaciones, iniciales en
// el header, etc.) nunca puede quedar desactualizado.
export const ROL_LABEL: Record<Rol, string> = {
  SUPERADMIN: "Superadmin",
  ADMIN: "Administrador",
  ENCARGADO_MANTENIMIENTO: "Encargado de mantenimiento",
  ENCARGADO_COMPRAS: "Encargado de compras",
  MECANICO_INTERNO: "Mecánico interno",
  CHOFER: "Chofer",
  GERENTE: "Gerente",
  CONTADOR: "Contador",
  GUARDIA: "Guardia",
};

// Roles que pueden configurarse como destinatarios de un aviso automático —
// todos salvo SUPERADMIN, que no pertenece a ninguna empresa y por lo tanto
// nunca es destinatario de una regla de notificación por empresa.
export const ROLES_NOTIFICABLES: Rol[] = (Object.keys(ROL_LABEL) as Rol[]).filter(
  (rol) => rol !== "SUPERADMIN"
);
